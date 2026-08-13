-- Journal OS V7.4.3 web migration — manual IBKR sync requests.
--
-- Additive only. The deployed Next.js app cannot call the
-- Interactive_Brokers_IBKR MCP connector directly — same constraint that
-- makes the whole sync an agent-turn Routine, not a server integration
-- (see docs/ibkr-agent-sync-runbook.md). A "Sync IBKR now" button in the
-- Journal UI therefore can only record the user's intent here; the next
-- scheduled sync Routine firing checks for a pending row before its
-- normal DST time-window guard and, if found, runs regardless of time
-- of day, then marks this row 'completed' and links the resulting
-- broker_sync_runs row.

create table public.manual_sync_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,

  requested_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'picked_up', 'completed')),
  picked_up_at timestamptz,
  broker_sync_run_id uuid references public.broker_sync_runs(id) on delete set null,

  created_at timestamptz not null default now()
);

create index manual_sync_requests_status_idx on public.manual_sync_requests(status);
create index manual_sync_requests_requested_at_idx on public.manual_sync_requests(requested_at desc);

alter table public.manual_sync_requests enable row level security;

grant select, insert, update on public.manual_sync_requests to authenticated;

create policy "manual_sync_requests_owner_rw"
on public.manual_sync_requests for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

grant select, insert, update on public.manual_sync_requests to service_role;
