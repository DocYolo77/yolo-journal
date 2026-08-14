-- Journal OS V7.4.3 web migration — Weekly Review.
--
-- Additive only. Same two-table pattern as the Daily Report system
-- (20260814020000_create_daily_report_snapshots.sql): a DRAFT working
-- row plus an immutable FINAL snapshot.
--
-- weekly_reviews holds ONLY the manual interpretation fields and
-- lifecycle state — automatic aggregations (NLV series, guardrail
-- compliance, setup/structure breakdowns, diagnostics, etc.) are never
-- persisted here, they're computed live from daily_reviews/commitments/
-- shadowlist_decisions/campaigns/broker_* on every page load (same
-- "single source of truth, computed once" principle as
-- lib/data/report-snapshot.ts) until the week is finalized.
--
-- weekly_report_snapshots freezes that computation once, at
-- finalization time, exactly like daily_report_snapshots freezes a
-- Daily Review — unique(week_start) plus no update grant on `snapshot`
-- enforce "darf nicht still überschrieben werden" at the database
-- level.

create table public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,

  week_start date not null,
  week_end date not null,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'FINAL')),

  preconditions_note text,
  worked text,
  not_worked text,
  largest_missed_move_comment text,
  continue_doing text,
  improve text,
  eliminate text,
  next_week_changes text,
  process_grade text check (process_grade in ('A', 'B', 'C', 'D', 'F')),
  process_grade_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finalized_at timestamptz,

  unique (week_start)
);

create index weekly_reviews_week_start_idx on public.weekly_reviews(week_start desc);

create trigger weekly_reviews_set_updated_at
before update on public.weekly_reviews
for each row execute function public.set_updated_at();

create table public.weekly_report_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,

  weekly_review_id uuid not null references public.weekly_reviews(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  report_schema_version integer not null default 1,

  -- daily_report_snapshots.id values this week's aggregation was built
  -- from — lets a future Monthly Review reference sources without
  -- re-deriving them, per §21's Daily -> Weekly -> Monthly chain.
  source_daily_report_ids uuid[] not null default '{}',

  snapshot jsonb not null,

  created_at timestamptz not null default now(),

  unique (week_start)
);

create index weekly_report_snapshots_week_start_idx on public.weekly_report_snapshots(week_start desc);

-- ============================================================
-- RLS
-- ============================================================

alter table public.weekly_reviews enable row level security;
alter table public.weekly_report_snapshots enable row level security;

grant select, insert, update on public.weekly_reviews to authenticated;
grant select, insert on public.weekly_report_snapshots to authenticated;

create policy "weekly_reviews_owner_rw"
on public.weekly_reviews for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "weekly_report_snapshots_owner_rw"
on public.weekly_report_snapshots for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

grant select, insert, update on public.weekly_reviews to service_role;
grant select, insert on public.weekly_report_snapshots to service_role;
