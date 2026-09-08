-- yolo-journal v2 rewrite — "Umbau-Anweisung v2": from an analysis/
-- enforcement tool to a pure capture tool. The Daily Review no longer
-- judges, enforces, or computes anything — it stores inputs, and the
-- judgment happens in an LLM chat fed by the Markdown export.
--
-- Scope note: the v2 spec calls for DROP TABLE ... CASCADE on
-- commitments/campaigns/campaign_executions/broker_executions/
-- broker_account_snapshots/broker_positions_snapshots/
-- daily_report_snapshots too, but lib/weekly-review/fetch.ts and
-- realized-pnl.ts query every one of those tables directly, and the
-- spec's own closing line says "Weekly/Monthly bleiben vorerst
-- unangetastet" (stay untouched for now, reworked separately later).
-- Those two instructions conflict; per explicit user decision this
-- migration keeps all seven tables in place, untouched, so Weekly
-- Review keeps working exactly as before. Only the genuinely dead
-- audit_events table and the commitment child tables that nothing
-- (including Weekly Review) reads are dropped here.
--
-- The old daily_reviews and shadowlist_decisions tables have the same
-- problem one level deeper: Weekly Review's compute.ts reads their old
-- shape directly (review_type, guardrails jsonb, ticker_reviews jsonb,
-- list_type/decision/reason) which has nothing in common with the new
-- v2 shape. So instead of altering them in place, this migration
-- renames them to *_legacy (pure rename — same data, same indexes,
-- same triggers, same RLS, zero behavior change) and gives the clean
-- names to the new v2 tables. lib/weekly-review/fetch.ts is updated in
-- the same commit to read from the _legacy names.

-- 1. Drop dead audit_events — has not successfully written a row in
-- production for months (root cause never found) and nothing reads it.
-- Per the v2 spec, immutability now comes from the exported PDF, not a log.
drop table if exists public.audit_events cascade;

-- 2. Drop the commitment-workflow child tables. The Pre-Market
-- Commitment step is gone; the parent `commitments` table itself stays
-- (Weekly Review's fetch.ts reads specific columns off it directly),
-- but nothing reads these child tables outside the now-deleted
-- Commitment UI.
drop table if exists public.commitment_watchlist_items cascade;
drop table if exists public.commitment_ep_candidates cascade;
drop table if exists public.commitment_risk_changes cascade;
drop table if exists public.commitment_overrides cascade;

-- 3. Rename the old daily_reviews/shadowlist_decisions tables out of
-- the way for Weekly Review to keep using, unaffected by anything below.
-- Index names are schema-global in Postgres, so the old indexes are
-- renamed too — purely cosmetic, they keep working identically either way.
alter table public.daily_reviews rename to daily_reviews_legacy;
alter index daily_reviews_trade_date_idx rename to daily_reviews_legacy_trade_date_idx;
alter index daily_reviews_commitment_id_idx rename to daily_reviews_legacy_commitment_id_idx;

alter table public.shadowlist_decisions rename to shadowlist_decisions_legacy;
alter index shadowlist_decisions_user_id_idx rename to shadowlist_decisions_legacy_user_id_idx;
alter index shadowlist_decisions_commitment_id_idx rename to shadowlist_decisions_legacy_commitment_id_idx;
alter index shadowlist_decisions_trade_date_idx rename to shadowlist_decisions_legacy_trade_date_idx;

-- 4. New v2 daily_reviews — one row per trade_date, always editable
-- (no DRAFT/LOCKED, no finalization gate). Every field but trade_date
-- is optional; empty fields are simply omitted from the exports.
create table public.daily_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,

  trade_date date not null,

  -- Kopf
  risk_pct numeric,
  r_value_usd numeric,
  -- Optional (§6): the value now gets pulled live from the broker in
  -- the LLM chat instead of being hand-typed here.
  nlv_close numeric,
  self_grade text,

  -- Kontext
  market_context text,
  personal_state text,
  -- Half-steps are a real input (3.5 has occurred) so this is numeric,
  -- not int, despite the spec's illustrative SQL sketch using int.
  focus_level numeric,
  gameplan text,

  -- Fazit
  what_went_well text,
  what_went_wrong text,
  what_to_improve text,
  guardrails_note text,

  -- Ausblick
  next_session_plan text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (trade_date)
);

create index daily_reviews_trade_date_idx on public.daily_reviews(trade_date desc);

create trigger daily_reviews_set_updated_at
before update on public.daily_reviews
for each row execute function public.set_updated_at();

alter table public.daily_reviews enable row level security;

grant select, insert, update on public.daily_reviews to authenticated;

create policy "daily_reviews_owner_rw"
on public.daily_reviews for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

grant select, insert, update on public.daily_reviews to service_role;

-- 5. daily_review_watchlist — Ticker-Chips, scope='today' (Kopf) or
-- scope='next' (Ausblick). Replaces the abolished Pre-Market Commitment
-- watchlist; the 'next' rows of trade_date D get copied forward as the
-- 'today' rows of the next review at open time (application-layer
-- prefill, not a DB trigger — see lib/data/daily-review.ts).
create table public.daily_review_watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  review_id uuid not null references public.daily_reviews(id) on delete cascade,

  scope text not null default 'today' check (scope in ('today', 'next')),
  ticker text not null,
  sort_order int not null default 0,
  taken boolean not null default false,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index daily_review_watchlist_review_id_idx on public.daily_review_watchlist(review_id);

create trigger daily_review_watchlist_set_updated_at
before update on public.daily_review_watchlist
for each row execute function public.set_updated_at();

alter table public.daily_review_watchlist enable row level security;

grant select, insert, update, delete on public.daily_review_watchlist to authenticated;

create policy "daily_review_watchlist_owner_rw"
on public.daily_review_watchlist for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

grant select, insert, update, delete on public.daily_review_watchlist to service_role;

-- 6. daily_review_trades — repeatable trade cards, all free text, no
-- enums (setup language changes faster than any enum could keep up).
create table public.daily_review_trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  review_id uuid not null references public.daily_reviews(id) on delete cascade,

  sort_order int not null default 0,
  ticker text not null,
  setup text,
  trigger_tactic text,
  stop_logic text,
  what_happened text,
  my_thinking text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index daily_review_trades_review_id_idx on public.daily_review_trades(review_id);

create trigger daily_review_trades_set_updated_at
before update on public.daily_review_trades
for each row execute function public.set_updated_at();

alter table public.daily_review_trades enable row level security;

grant select, insert, update, delete on public.daily_review_trades to authenticated;

create policy "daily_review_trades_owner_rw"
on public.daily_review_trades for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

grant select, insert, update, delete on public.daily_review_trades to service_role;

-- 7. daily_review_guardrails — a fixed set of guardrail_keys (enforced
-- app-side, see lib/validation/daily-review.ts), click-only, documentation
-- not enforcement. Default state is absent (no row) — not "held" —
-- because the default must be empty per the v2 spec.
create table public.daily_review_guardrails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  review_id uuid not null references public.daily_reviews(id) on delete cascade,

  guardrail_key text not null,
  status text not null check (status in ('held', 'broken', 'na', 'override')),
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (review_id, guardrail_key)
);

create index daily_review_guardrails_review_id_idx on public.daily_review_guardrails(review_id);

create trigger daily_review_guardrails_set_updated_at
before update on public.daily_review_guardrails
for each row execute function public.set_updated_at();

alter table public.daily_review_guardrails enable row level security;

grant select, insert, update, delete on public.daily_review_guardrails to authenticated;

create policy "daily_review_guardrails_owner_rw"
on public.daily_review_guardrails for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

grant select, insert, update, delete on public.daily_review_guardrails to service_role;

-- 8. New v2 shadowlist_decisions — decoupled from the abolished
-- Commitment. Ticker source is now the review's own
-- daily_review_watchlist (scope='today'); the decision model
-- simplifies to a single taken boolean plus an optional note (no more
-- list_type/decision/reason enums, no auto-override — there is no
-- broker data left to auto-override from).
create table public.shadowlist_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  review_id uuid not null references public.daily_reviews(id) on delete cascade,

  -- Denormalized for straightforward per-day querying, same rationale
  -- as the legacy table.
  trade_date date not null,

  ticker text not null,
  taken boolean not null default false,
  note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (review_id, ticker)
);

create index shadowlist_decisions_review_id_idx on public.shadowlist_decisions(review_id);
create index shadowlist_decisions_trade_date_idx on public.shadowlist_decisions(trade_date);

create trigger shadowlist_decisions_set_updated_at
before update on public.shadowlist_decisions
for each row execute function public.set_updated_at();

alter table public.shadowlist_decisions enable row level security;

grant select, insert, update, delete on public.shadowlist_decisions to authenticated;

create policy "shadowlist_decisions_owner_rw"
on public.shadowlist_decisions for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

grant select, insert, update, delete on public.shadowlist_decisions to service_role;
