-- Journal OS V7.4.3 web migration — broker position snapshots.
--
-- Additive only. Prepares the broker layer to also sync positions
-- alongside executions (broker_executions) and account/NLV state
-- (broker_account_snapshots) — same append-only, historized pattern:
-- every capture is a new row, never overwritten in place, so intraday
-- and day-over-day position history stays reconstructable.

create table public.broker_positions_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,

  provider text not null default 'IBKR',
  -- Matches broker_account_snapshots.provider_account_id — our own
  -- stable internal identifier ("main" for the single-account V1),
  -- not necessarily IBKR's own account number. May be remapped to a
  -- real provider account id later without touching historical rows.
  provider_account_id text not null,

  trading_date date not null,
  captured_at timestamptz not null,

  symbol text not null,
  -- IBKR's own contract identifier, stable across a symbol's lifetime
  -- even through renames/relistings — kept alongside symbol so future
  -- reconciliation isn't purely string-matching on ticker text.
  provider_contract_id text,
  asset_class text,

  quantity numeric(24,8) not null,
  average_price numeric(20,8),
  market_price numeric(20,8),
  market_value numeric(20,4),
  currency text,
  unrealized_pnl numeric(20,4),
  daily_pnl numeric(20,4),

  raw_payload jsonb,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  unique (provider, provider_account_id, provider_contract_id, trading_date, captured_at)
);

create index broker_positions_snapshots_user_id_idx on public.broker_positions_snapshots(user_id);
create index broker_positions_snapshots_trading_date_idx on public.broker_positions_snapshots(trading_date);
create index broker_positions_snapshots_symbol_idx on public.broker_positions_snapshots(symbol);

alter table public.broker_positions_snapshots enable row level security;

grant select, insert on public.broker_positions_snapshots to authenticated;

create policy "broker_positions_snapshots_owner_rw"
on public.broker_positions_snapshots for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

grant select, insert on public.broker_positions_snapshots to service_role;
