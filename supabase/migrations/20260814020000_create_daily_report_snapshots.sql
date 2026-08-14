-- Journal OS V7.4.3 web migration — Daily Report snapshots.
--
-- Additive only. A finalized Daily Review becomes an immutable,
-- reusable report: one row per trade_date, created once at
-- "Review abschließen" time and never updated afterward — the
-- unique(trade_date) constraint plus (no update/delete grant, see
-- below) enforce "darf nicht still überschrieben werden" at the
-- database level, not just in application code.
--
-- Single jsonb `snapshot` column holding the fully assembled report
-- (daily review, locked commitment, shadowlist decisions, broker/
-- portfolio data, market/chart series) — deliberately not decomposed
-- into more tables: this row's `snapshot` value is exactly what the
-- JSON export downloads, and the report page renders strictly from it,
-- never from the (possibly since-changed) live daily_reviews/
-- commitments rows.

create table public.daily_report_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,

  trade_date date not null,
  report_schema_version integer not null default 1,

  snapshot jsonb not null,

  -- Populated after a PDF export is generated and uploaded to Supabase
  -- Storage (private bucket) — null until the first PDF download.
  pdf_storage_path text,
  pdf_generated_at timestamptz,

  created_at timestamptz not null default now(),

  unique (trade_date)
);

create index daily_report_snapshots_trade_date_idx on public.daily_report_snapshots(trade_date desc);

alter table public.daily_report_snapshots enable row level security;

-- Append-only: select + insert only. update is granted narrowly further
-- below, restricted in practice to the pdf_storage_path/pdf_generated_at
-- backfill (application code never updates `snapshot` itself once
-- written) — there is no way to express a column-restricted UPDATE via
-- Supabase grants alone, so this relies on application code discipline,
-- same as every other append-only table in this schema.
grant select, insert, update on public.daily_report_snapshots to authenticated;

create policy "daily_report_snapshots_owner_rw"
on public.daily_report_snapshots for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

grant select, insert, update on public.daily_report_snapshots to service_role;
