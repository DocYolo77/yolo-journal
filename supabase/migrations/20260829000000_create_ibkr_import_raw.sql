-- Manual IBKR JSON import — fallback ingestion path for when the
-- automated Flex sync isn't working (see lib/broker/ibkr-json-*.ts).
--
-- This table exists ONLY to preserve the original uploaded/pasted JSON
-- verbatim (§15 of the coding instruction) — the normalized data itself
-- goes into the exact same broker_executions / broker_account_snapshots
-- / broker_positions_snapshots tables the Flex sync already writes to,
-- via the same normalized shapes and the same campaign-reconciliation /
-- shadowlist-auto-override / MTD-auto / loss-streak-auto pipeline
-- (lib/broker/ibkr-sync.ts). A parser or data-model change later must
-- never mean the original import is lost — that's what raw_json is for.
--
-- Append-only, no unique constraint on review_date: re-importing the
-- same day is expected (idempotency for the normalized data is handled
-- separately, at the broker_* table level) and every raw copy is kept.
--
-- Additive only.

create table public.ibkr_import_raw (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,

  review_date date not null,
  schema_version text,
  snapshot_datetime timestamptz,
  raw_json jsonb not null,

  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index ibkr_import_raw_review_date_idx on public.ibkr_import_raw(review_date desc);
create index ibkr_import_raw_user_id_idx on public.ibkr_import_raw(user_id);

alter table public.ibkr_import_raw enable row level security;

grant select, insert on public.ibkr_import_raw to authenticated;

create policy "ibkr_import_raw_owner_rw"
on public.ibkr_import_raw for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

grant select, insert on public.ibkr_import_raw to service_role;
