-- Journal OS V7.4.3 web migration — Daily Review & Coaching Journal
-- (LEGACY_JOURNAL_OS_V7_4_3_REFERENCE.md §8/§11/§13-16).
--
-- Additive only. Single table, not the full canonical multi-table object
-- graph the legacy reference lists (reconcile/portfolio/campaign_
-- annotations/shadow_results/report_files etc.) — those are P1
-- (IBKR/Massive automation) and out of scope for the Beta, which must
-- work fully manually. The nested/repeating pieces (per-ticker reviews,
-- guardrail checklist, mental status, operational todos) are jsonb
-- rather than child tables, per the explicit instruction to check
-- whether a JSON/metadata structure is sufficient before adding more
-- tables. One row per trade_date (upsert, not versioned — unlike
-- commitments, the legacy reference does not require Daily Review
-- revision history for the Beta).

create table public.daily_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,

  trade_date date not null,
  review_type text check (review_type in ('ENTRY', 'MANAGEMENT')),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'COMPLETED')),

  -- Set when no locked commitments row exists for trade_date at save
  -- time — a historical day being reconstructed after the fact, never
  -- silently presented as if a premarket plan had existed.
  is_reconstructed boolean not null default false,
  commitment_id uuid references public.commitments(id) on delete set null,

  -- Portfolio (§12 reconcile, manual V1 — no automatic IBKR/NLV sync yet).
  net_liquidation_value numeric(20,4),
  daily_pnl numeric(20,4),

  -- Market review (§13).
  market_thought text,
  market_environment text,

  -- Guardrails (§14): array of
  -- {guardrail_id, guardrail, status: 'Eingehalten'|'Verletzt'|'Nicht anwendbar', comment}.
  guardrails jsonb not null default '[]'::jsonb,

  -- Mental status (§15): {states: string[], other_state, focus (1-5),
  -- influence, influence_note}.
  mental jsonb not null default '{}'::jsonb,

  -- Coaching / conclusion (§16).
  positive text,
  weakness text,
  coaching_take text,
  self_grade text,
  grade_reason text,
  -- string[] of free-text todo items.
  operational_todos jsonb not null default '[]'::jsonb,

  -- Per-ticker reviews (§11): array of {ticker, setup, trigger, structure,
  -- structure_rating, thesis, intended_stop_logic, management_intent,
  -- management_grade, rule_status, notes}. Tickers may be added manually
  -- for the Beta (no IBKR campaign reconstruction feeding this yet).
  ticker_reviews jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (trade_date)
);

create index daily_reviews_trade_date_idx on public.daily_reviews(trade_date desc);
create index daily_reviews_commitment_id_idx on public.daily_reviews(commitment_id);

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
