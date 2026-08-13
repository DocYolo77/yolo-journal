-- Journal OS V7.4.3 web migration — Phase 1: Pre-Market Commitment.
--
-- Additive only. Does not modify, drop, or repurpose any table created by
-- 20260813164800_initial_schema.sql / 20260813164801_grant_service_role.sql.
-- Those tables (accounts, strategies, trades, executions, trade_metrics,
-- tags, trade_tags, journal_days, attachments) belong to the earlier,
-- incorrect generic-trading-journal product model and are left untouched
-- and unused by the new app. They will be removed in a dedicated future
-- migration once the Journal OS model is fully online — never edited here.
--
-- Reuses public.set_updated_at() and pgcrypto (gen_random_uuid()) from the
-- initial schema migration; both already exist by the time this runs.

-- ============================================================
-- commitments — one immutable row per (trade_date, revision).
-- Every save while in DRAFT inserts a new revision row rather than
-- updating the previous one. The row with the highest revision for a
-- trade_date is the "current" state. Once a revision's status is LOCKED,
-- that row is never updated again — watchlist/EP/hard-rule membership at
-- that row's id is the permanent locked snapshot. Further intraday risk
-- reductions are recorded in commitment_risk_changes, not by mutating
-- this row.
-- ============================================================

create table public.commitments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,

  schema_version integer not null default 1,
  trade_date date not null,
  revision integer not null check (revision >= 1),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'LOCKED')),

  -- Section 2 · QQQ-EXTENSION market snapshot (QQQ/SPY close, EMAs, SMAs,
  -- ATR14, ATR%, ATR multiple, session count, SMA200 readiness, ...).
  -- Kept as a single JSONB block: atomic snapshot, not individually
  -- queried, and its exact field set is a market-data concern rather than
  -- commitment/lock logic.
  market_snapshot jsonb,

  -- Section 1 · STATE + R%
  personal_state text,
  market_state_note text,
  system_risk_pct numeric(6,4),
  committed_risk_pct numeric(6,4),
  intraday_risk_pct numeric(6,4),

  -- Section 2 · QQQ-EXTENSION
  qqq_extension_atr_multiple numeric(10,4),
  qqq_extension_cap_active boolean not null default false,
  qqq_extension_note text,

  -- Section 3 · MTD % — NUR NEUE ENTRIES
  mtd_manual_pct numeric(8,4),
  mtd_auto_fresh_entry_realized_pct numeric(8,4),
  mtd_pause_threshold_reached boolean not null default false,
  mtd_note text,

  -- Section 4 · VERLUSTZÄHLER (per-revision snapshot; persistent cross-day
  -- state itself lives in loser_risk_state)
  loss_state_manual_counter integer,
  loss_state_auto_counter integer,
  loss_state_review_trigger_reached boolean not null default false,
  loss_state_reduced_size_mode boolean not null default false,
  loss_state_note text,

  -- Section 7 · OPERATIVER PLAN
  operational_plan text,
  improvement_focus text,

  -- Hard rules stored in the commitment
  max_tickers integer not null default 3,
  source_lock boolean not null default true,
  intraday_hand_adds integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  locked_at timestamptz,

  -- Committed risk may not exceed the system risk cap; intraday risk may
  -- never exceed committed risk. Downward-only movement *after* lock is
  -- enforced at the application layer (this checks the static snapshot
  -- of a single revision, not the transition between revisions).
  check (committed_risk_pct is null or system_risk_pct is null or committed_risk_pct <= system_risk_pct),
  check (intraday_risk_pct is null or committed_risk_pct is null or intraday_risk_pct <= committed_risk_pct),
  check (locked_at is null or status = 'LOCKED')
);

create index commitments_user_id_idx on public.commitments(user_id);
create index commitments_trade_date_idx on public.commitments(trade_date);
create index commitments_trade_date_revision_idx on public.commitments(trade_date, revision desc);

create unique index commitments_user_trade_revision_unique
  on public.commitments(user_id, trade_date, revision)
  where user_id is not null;
create unique index commitments_single_user_trade_revision_unique
  on public.commitments(trade_date, revision)
  where user_id is null;

create trigger commitments_set_updated_at
before update on public.commitments
for each row execute function public.set_updated_at();

-- ============================================================
-- commitment_watchlist_items — Section 5 · WATCHLIST.
-- Belongs to one specific commitment revision. Once that revision is
-- LOCKED, rows tied to it are never updated or deleted by the app.
-- ============================================================

create table public.commitment_watchlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  commitment_id uuid not null references public.commitments(id) on delete cascade,

  ticker text not null,
  risk_pct numeric(6,4),
  list_type text not null check (list_type in ('Prime', 'Watchlist', 'Secondary')),
  notes text,

  -- Preserves original paste/import order.
  sort_order integer not null default 0,

  created_at timestamptz not null default now()
);

create index commitment_watchlist_items_user_id_idx on public.commitment_watchlist_items(user_id);
create index commitment_watchlist_items_commitment_id_idx on public.commitment_watchlist_items(commitment_id);

-- ============================================================
-- commitment_ep_candidates — Section 6 · EP-KANDIDATEN.
-- An EP candidate ticker is expected (app-layer validation) to also
-- appear in commitment_watchlist_items for the same commitment_id.
-- ============================================================

create table public.commitment_ep_candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  commitment_id uuid not null references public.commitments(id) on delete cascade,

  ticker text not null,
  gap_8_pct boolean not null default false,
  rvol_1_5 boolean not null default false,
  news_trigger boolean not null default false,
  event_day boolean not null default false,
  context_not_defensive boolean not null default false,
  notes text,

  created_at timestamptz not null default now()
);

create index commitment_ep_candidates_user_id_idx on public.commitment_ep_candidates(user_id);
create index commitment_ep_candidates_commitment_id_idx on public.commitment_ep_candidates(commitment_id);

-- ============================================================
-- commitment_risk_changes — append-only intraday risk reduction history
-- for a LOCKED commitment. Downward-only is enforced both here (check
-- constraint) and at the application layer before insert.
-- ============================================================

create table public.commitment_risk_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  commitment_id uuid not null references public.commitments(id) on delete cascade,

  changed_at timestamptz not null default now(),
  old_risk_pct numeric(6,4) not null,
  new_risk_pct numeric(6,4) not null,
  reason text,

  created_at timestamptz not null default now(),

  check (new_risk_pct < old_risk_pct)
);

create index commitment_risk_changes_user_id_idx on public.commitment_risk_changes(user_id);
create index commitment_risk_changes_commitment_id_idx on public.commitment_risk_changes(commitment_id);

-- ============================================================
-- commitment_overrides — append-only log of documented deviations from
-- the locked plan (e.g. a manually justified exception). Distinct from
-- risk reductions, which have their own dedicated, stricter table.
-- ============================================================

create table public.commitment_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  commitment_id uuid not null references public.commitments(id) on delete cascade,

  occurred_at timestamptz not null default now(),
  override_type text not null,
  description text not null,

  created_at timestamptz not null default now()
);

create index commitment_overrides_user_id_idx on public.commitment_overrides(user_id);
create index commitment_overrides_commitment_id_idx on public.commitment_overrides(commitment_id);

-- ============================================================
-- loser_risk_state — persistent cross-day loser-count / reduced-size
-- state. Append-only: every change inserts a new row rather than
-- mutating the previous one, consistent with the system's audit
-- philosophy. The app reads the most recent row (order by updated_at
-- desc) as "current" state.
-- ============================================================

create table public.loser_risk_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,

  as_of date not null,
  loser_count integer not null default 0,
  reduced_size_mode boolean not null default false,
  source text,

  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index loser_risk_state_user_id_idx on public.loser_risk_state(user_id);
create index loser_risk_state_updated_at_idx on public.loser_risk_state(updated_at desc);

-- ============================================================
-- audit_events — append-only, hash-chained event ledger. Hashing itself
-- (previous_hash / hash) is computed application-side over a canonical
-- representation of the event; the DB only stores and never mutates the
-- result. No update/delete policy is granted for this table.
-- ============================================================

create table public.audit_events (
  event_id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,

  -- Monotonic ordering independent of wall-clock timestamps, used to
  -- reliably reconstruct hash-chain order.
  seq bigserial not null,

  schema_version integer not null default 1,
  event_time timestamptz not null default now(),
  event_type text not null,
  trade_date date,
  entity_type text not null,
  entity_id uuid,
  actor text,
  payload jsonb,

  previous_hash text,
  hash text not null,

  created_at timestamptz not null default now(),

  unique (seq)
);

create index audit_events_user_id_idx on public.audit_events(user_id);
create index audit_events_entity_idx on public.audit_events(entity_type, entity_id);
create index audit_events_trade_date_idx on public.audit_events(trade_date);
create index audit_events_seq_idx on public.audit_events(seq);

-- ============================================================
-- RLS
-- ============================================================

alter table public.commitments enable row level security;
alter table public.commitment_watchlist_items enable row level security;
alter table public.commitment_ep_candidates enable row level security;
alter table public.commitment_risk_changes enable row level security;
alter table public.commitment_overrides enable row level security;
alter table public.loser_risk_state enable row level security;
alter table public.audit_events enable row level security;

-- Everything is insert/select only for `authenticated` (future multi-user
-- direct access) — no update/delete grants anywhere, matching the
-- append-only / immutable-once-locked model. The V1 app itself talks to
-- Postgres via the service-role secret key server-side, which bypasses
-- RLS entirely; these policies matter once real user auth exists.

grant select, insert on public.commitments to authenticated;
grant select, insert on public.commitment_watchlist_items to authenticated;
grant select, insert on public.commitment_ep_candidates to authenticated;
grant select, insert on public.commitment_risk_changes to authenticated;
grant select, insert on public.commitment_overrides to authenticated;
grant select, insert on public.loser_risk_state to authenticated;
grant select, insert on public.audit_events to authenticated;

create policy "commitments_owner_rw"
on public.commitments for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "commitment_watchlist_items_owner_rw"
on public.commitment_watchlist_items for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "commitment_ep_candidates_owner_rw"
on public.commitment_ep_candidates for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "commitment_risk_changes_owner_rw"
on public.commitment_risk_changes for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "commitment_overrides_owner_rw"
on public.commitment_overrides for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "loser_risk_state_owner_rw"
on public.loser_risk_state for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "audit_events_owner_rw"
on public.audit_events for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

-- ============================================================
-- service_role grants (server-side secret-key access used by the V1
-- single-user app; bypasses RLS, mirrors 20260813164801_grant_service_role.sql)
-- ============================================================

grant select, insert on public.commitments to service_role;
grant select, insert on public.commitment_watchlist_items to service_role;
grant select, insert on public.commitment_ep_candidates to service_role;
grant select, insert on public.commitment_risk_changes to service_role;
grant select, insert on public.commitment_overrides to service_role;
grant select, insert on public.loser_risk_state to service_role;
grant select, insert on public.audit_events to service_role;
