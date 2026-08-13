-- Journal OS V7.4.3 web migration — Market Data (Massive) + Broker (IBKR)
-- data model, per JOURNAL_OS_DATA_INTEGRATION_ARCHITECTURE.md.
--
-- Additive only. Does not touch any earlier migration. trades/executions/
-- trade_metrics from the original generic-journal migration remain
-- deprecated and unused — campaigns/broker_executions below are clean new
-- tables, not a repurposing of those (per explicit decision: raw broker
-- fills and journal-level campaigns must stay structurally distinct, and
-- the old tables' shape doesn't fit either role cleanly).
--
-- No provider client code ships in this migration — only the schema that
-- Phase B (Massive) / Phase C-D (IBKR) will populate once real
-- credentials exist. Massive raw bars are deliberately not mirrored here
-- (§14 of the architecture doc): only computed results are persisted.

-- ============================================================
-- shadow_model_results — §4. Generic M5/M15/M30 ORB shadow model,
-- computed for every committed ticker regardless of which setup was
-- actually taken (comparison/selection layer, not a trade-validity
-- gate). calculation_version lets a re-run under an improved algorithm
-- coexist with prior results instead of silently overwriting them.
-- ============================================================

create table public.shadow_model_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,

  ticker text not null,
  trade_date date not null,
  orb_minutes integer not null check (orb_minutes in (5, 15, 30)),

  orh numeric(20,8),
  orl numeric(20,8),
  trigger_timestamp timestamptz,
  entry_price numeric(20,8),
  stop_price numeric(20,8),
  exit_timestamp timestamptz,
  exit_price numeric(20,8),
  exit_reason text,
  modeled_r numeric(12,6),
  mfe_r numeric(12,6),
  mae_r numeric(12,6),
  rth_close_r numeric(12,6),
  same_bar_ambiguous boolean not null default false,
  actually_traded boolean not null default false,

  market_data_provider text not null default 'massive',
  calculation_version text not null,
  calculated_at timestamptz not null default now(),

  created_at timestamptz not null default now(),

  unique (ticker, trade_date, orb_minutes, calculation_version)
);

create index shadow_model_results_user_id_idx on public.shadow_model_results(user_id);
create index shadow_model_results_trade_date_idx on public.shadow_model_results(trade_date);
create index shadow_model_results_ticker_date_idx on public.shadow_model_results(ticker, trade_date);

-- ============================================================
-- committed_focus_audit — §5 / LEGACY_JOURNAL_OS_V7_4_3_REFERENCE.md §7.
-- One specific mechanical M30 audit implementation among several
-- possible research/selection auditors — explicitly not the definition
-- of a valid trade and not a replacement for the commitment.
-- ============================================================

create table public.committed_focus_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,

  ticker text not null,
  trade_date date not null,
  orb_minutes integer not null default 30,

  status text,
  qualified boolean,
  orh numeric(20,8),
  orl numeric(20,8),
  opening_bar_count integer,
  trigger_timestamp timestamptz,
  entry_price numeric(20,8),

  known_lod_at_entry boolean,
  lod_reference text,
  lod_reference_high numeric(20,8),
  lod_reference_low numeric(20,8),
  lod_distance_auto_1600_pct numeric(12,6),
  lod_distance_source text,
  lod_distance_pct numeric(12,6),

  m30_or_range_pct_atr numeric(12,6),
  atr14_d1 numeric(20,8),
  sma50_d1 numeric(20,8),
  sma50_atr_extension_at_entry numeric(12,6),

  reason text,
  missing text,

  stop_type text check (stop_type in ('M30_ORL', 'M15_ORL', 'M5_ORL', 'FIXED_PERCENT', 'MANUAL_PRICE')),
  stop_price numeric(20,8),
  stop_comment text,
  default_stop_used boolean,

  actually_traded boolean not null default false,
  decision text,

  calculation_version text not null,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  unique (ticker, trade_date, calculation_version)
);

create index committed_focus_audit_user_id_idx on public.committed_focus_audit(user_id);
create index committed_focus_audit_trade_date_idx on public.committed_focus_audit(trade_date);
create index committed_focus_audit_ticker_date_idx on public.committed_focus_audit(ticker, trade_date);

-- ============================================================
-- broker_executions — §7/§8. Raw fills. "Ticker statt Klicks zählen":
-- this table is deliberately the raw ledger, never the journal/process
-- unit — campaigns (below) is that unit. Append-only: no update grant.
-- ============================================================

create table public.broker_executions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,

  provider text not null default 'IBKR',
  provider_execution_id text,
  -- Always populated: provider_execution_id when the provider supplies
  -- one, otherwise a deterministic hash of
  -- (provider, symbol, side, quantity, price, executed_at, order_id)
  -- computed in lib/broker/execution-normalize.ts. This is what
  -- deduplication actually keys off, so a missing provider id never
  -- results in silent duplicate imports.
  dedup_key text not null,

  order_id text,
  symbol text not null,
  asset_class text,
  side text not null check (side in ('BUY', 'SELL')),
  quantity numeric(24,8) not null check (quantity >= 0),
  price numeric(20,8),
  executed_at timestamptz not null,
  commission numeric(20,4),
  commission_currency text,
  open_close text not null default 'UNKNOWN' check (open_close in ('OPEN', 'CLOSE', 'UNKNOWN')),
  currency text,

  raw_payload jsonb,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  unique (provider, dedup_key)
);

create index broker_executions_user_id_idx on public.broker_executions(user_id);
create index broker_executions_symbol_idx on public.broker_executions(symbol);
create index broker_executions_executed_at_idx on public.broker_executions(executed_at);

-- ============================================================
-- campaigns — §9. Economic grouping of broker_executions. This is the
-- journal/process unit; process evaluation (Selection/Execution/
-- Management) happens here, never at the individual-fill level.
--
-- entry_strategy / intended_trigger are intentionally free text, not a
-- CHECK-constrained enum: the architecture doc explicitly requires
-- supporting an open, documented set of entry models without bias
-- toward any one of them (§3, §21.11). The known vocabulary from
-- LEGACY_JOURNAL_OS_V7_4_3_REFERENCE.md §11 is enforced as a UI select
-- (with a free-text "Sonstiges" escape hatch) at the application layer
-- instead, so a legitimate new setup is never blocked by the database.
-- ============================================================

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,

  trade_date date not null,
  symbol text not null,
  direction text check (direction in ('long', 'short')),

  started_at timestamptz,
  ended_at timestamptz,
  status text not null default 'open' check (status in ('open', 'closed')),

  initial_entry numeric(20,8),
  entry_strategy text,
  intended_trigger text,
  initial_stop numeric(20,8),
  current_stop numeric(20,8),
  notes text,

  -- 'reconstructed' (normal fill-derived grouping) vs
  -- 'prior_position_unresolved' (position exists without matching
  -- opening executions in broker_executions — flagged for human
  -- confirmation, never auto-resolved) vs 'manual'.
  source text not null default 'reconstructed' check (
    source in ('reconstructed', 'prior_position_unresolved', 'manual')
  ),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (ended_at is null or started_at is null or ended_at >= started_at)
);

create index campaigns_user_id_idx on public.campaigns(user_id);
create index campaigns_trade_date_idx on public.campaigns(trade_date);
create index campaigns_symbol_idx on public.campaigns(symbol);
create index campaigns_status_idx on public.campaigns(status);

create trigger campaigns_set_updated_at
before update on public.campaigns
for each row execute function public.set_updated_at();

-- ============================================================
-- campaign_executions — §9. Clean campaign <-> broker_executions
-- mapping. unique(broker_execution_id) guarantees a single fill is
-- never economically double-counted across two campaigns.
-- ============================================================

create table public.campaign_executions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,

  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  broker_execution_id uuid not null references public.broker_executions(id) on delete cascade,

  created_at timestamptz not null default now(),

  unique (broker_execution_id)
);

create index campaign_executions_user_id_idx on public.campaign_executions(user_id);
create index campaign_executions_campaign_id_idx on public.campaign_executions(campaign_id);

-- ============================================================
-- broker_account_snapshots — §10/§11. NLV and account-level metrics.
-- Append-only history, never overwritten in place, so account
-- performance stays reconstructable independent of trade-level P&L
-- (§12: a big existing winner giving back paper gains must be visible
-- as an NLV move, not confused with a fresh bad selection/entry/rule
-- break).
-- ============================================================

create table public.broker_account_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,

  provider text not null default 'IBKR',
  provider_account_id text not null,
  account_id uuid references public.accounts(id) on delete set null,

  trading_date date not null,
  captured_at timestamptz not null,

  net_liquidation_value numeric(20,4),
  start_of_day_nlv numeric(20,4),
  cash numeric(20,4),
  buying_power numeric(20,4),
  gross_position_value numeric(20,4),
  gross_exposure_pct numeric(12,6),
  net_exposure_pct numeric(12,6),
  realized_pnl_day numeric(20,4),
  unrealized_pnl numeric(20,4),
  unrealized_pnl_day numeric(20,4),
  maintenance_margin numeric(20,4),
  available_funds numeric(20,4),
  excess_liquidity numeric(20,4),
  base_currency text,

  source text,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  unique (provider, provider_account_id, trading_date, captured_at)
);

create index broker_account_snapshots_user_id_idx on public.broker_account_snapshots(user_id);
create index broker_account_snapshots_trading_date_idx on public.broker_account_snapshots(trading_date);
create index broker_account_snapshots_account_id_idx on public.broker_account_snapshots(account_id);

-- ============================================================
-- broker_sync_runs — §16. Auditability for every sync attempt.
-- Updated in place as a run progresses (started -> completed_at/status
-- set), unlike the append-only tables above.
-- ============================================================

create table public.broker_sync_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,

  provider text not null,
  sync_type text not null check (sync_type in ('executions', 'account_snapshot')),

  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running' check (status in ('running', 'success', 'partial', 'failed')),

  source_period_start timestamptz,
  source_period_end timestamptz,

  rows_received integer,
  rows_inserted integer,
  rows_skipped integer,
  rows_updated integer,
  error_summary text,

  created_at timestamptz not null default now()
);

create index broker_sync_runs_user_id_idx on public.broker_sync_runs(user_id);
create index broker_sync_runs_provider_idx on public.broker_sync_runs(provider, sync_type);
create index broker_sync_runs_started_at_idx on public.broker_sync_runs(started_at desc);

-- ============================================================
-- RLS
-- ============================================================

alter table public.shadow_model_results enable row level security;
alter table public.committed_focus_audit enable row level security;
alter table public.broker_executions enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_executions enable row level security;
alter table public.broker_account_snapshots enable row level security;
alter table public.broker_sync_runs enable row level security;

grant select, insert, update on public.shadow_model_results to authenticated;
grant select, insert, update on public.committed_focus_audit to authenticated;
grant select, insert on public.broker_executions to authenticated;
grant select, insert, update on public.campaigns to authenticated;
grant select, insert, delete on public.campaign_executions to authenticated;
grant select, insert on public.broker_account_snapshots to authenticated;
grant select, insert, update on public.broker_sync_runs to authenticated;

create policy "shadow_model_results_owner_rw"
on public.shadow_model_results for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "committed_focus_audit_owner_rw"
on public.committed_focus_audit for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "broker_executions_owner_rw"
on public.broker_executions for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "campaigns_owner_rw"
on public.campaigns for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "campaign_executions_owner_rw"
on public.campaign_executions for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "broker_account_snapshots_owner_rw"
on public.broker_account_snapshots for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "broker_sync_runs_owner_rw"
on public.broker_sync_runs for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

grant select, insert, update on public.shadow_model_results to service_role;
grant select, insert, update on public.committed_focus_audit to service_role;
grant select, insert on public.broker_executions to service_role;
grant select, insert, update on public.campaigns to service_role;
grant select, insert, delete on public.campaign_executions to service_role;
grant select, insert on public.broker_account_snapshots to service_role;
grant select, insert, update on public.broker_sync_runs to service_role;
