
-- yolo-journal V1 schema
-- Single-user first, multi-user ready.
-- user_id is nullable for the initial private V1 and can be backfilled + made NOT NULL once Auth is enabled.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  broker text,
  base_currency text not null default 'USD',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index accounts_user_id_idx on public.accounts(user_id);
create unique index accounts_user_name_unique
  on public.accounts(user_id, lower(name))
  where user_id is not null;
create unique index accounts_single_user_name_unique
  on public.accounts(lower(name))
  where user_id is null;

create trigger accounts_set_updated_at
before update on public.accounts
for each row execute function public.set_updated_at();

create table public.strategies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index strategies_user_id_idx on public.strategies(user_id);
create unique index strategies_user_name_unique
  on public.strategies(user_id, lower(name))
  where user_id is not null;
create unique index strategies_single_user_name_unique
  on public.strategies(lower(name))
  where user_id is null;

create trigger strategies_set_updated_at
before update on public.strategies
for each row execute function public.set_updated_at();

create table public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  strategy_id uuid references public.strategies(id) on delete set null,

  symbol text not null,
  asset_class text not null default 'stock'
    check (asset_class in ('stock', 'etf', 'option', 'future', 'forex', 'crypto', 'index', 'other')),
  direction text not null
    check (direction in ('long', 'short')),
  status text not null default 'open'
    check (status in ('planned', 'open', 'closed', 'cancelled')),

  opened_at timestamptz,
  closed_at timestamptz,

  planned_entry numeric(20,8),
  initial_stop numeric(20,8),
  initial_risk_amount numeric(20,4),
  initial_risk_pct numeric(10,6),

  thesis text,
  notes text,
  mistake_notes text,
  process_rating smallint check (process_rating between 1 and 5),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (closed_at is null or opened_at is null or closed_at >= opened_at),
  check (initial_risk_amount is null or initial_risk_amount >= 0),
  check (initial_risk_pct is null or initial_risk_pct >= 0)
);

create index trades_user_id_idx on public.trades(user_id);
create index trades_account_id_idx on public.trades(account_id);
create index trades_strategy_id_idx on public.trades(strategy_id);
create index trades_symbol_idx on public.trades(symbol);
create index trades_status_idx on public.trades(status);
create index trades_opened_at_idx on public.trades(opened_at desc);

create trigger trades_set_updated_at
before update on public.trades
for each row execute function public.set_updated_at();

create table public.executions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  trade_id uuid not null references public.trades(id) on delete cascade,

  side text not null check (side in ('buy', 'sell')),
  execution_type text not null default 'fill'
    check (execution_type in ('fill', 'fee', 'adjustment')),
  executed_at timestamptz not null,
  quantity numeric(24,8) not null check (quantity >= 0),
  price numeric(20,8),
  fees numeric(20,4) not null default 0,
  broker_order_id text,
  notes text,

  created_at timestamptz not null default now()
);

create index executions_user_id_idx on public.executions(user_id);
create index executions_trade_id_idx on public.executions(trade_id);
create index executions_executed_at_idx on public.executions(executed_at);

create table public.trade_metrics (
  trade_id uuid primary key references public.trades(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,

  avg_entry numeric(20,8),
  avg_exit numeric(20,8),
  gross_pnl numeric(20,4),
  net_pnl numeric(20,4),
  r_multiple numeric(12,6),
  mae_pct numeric(12,6),
  mae_r numeric(12,6),
  mfe_pct numeric(12,6),
  mfe_r numeric(12,6),
  holding_minutes integer check (holding_minutes is null or holding_minutes >= 0),

  calculated_at timestamptz not null default now()
);

create index trade_metrics_user_id_idx on public.trade_metrics(user_id);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  category text,
  created_at timestamptz not null default now()
);

create index tags_user_id_idx on public.tags(user_id);
create unique index tags_user_name_unique
  on public.tags(user_id, lower(name))
  where user_id is not null;
create unique index tags_single_user_name_unique
  on public.tags(lower(name))
  where user_id is null;

create table public.trade_tags (
  trade_id uuid not null references public.trades(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (trade_id, tag_id)
);

create index trade_tags_user_id_idx on public.trade_tags(user_id);
create index trade_tags_tag_id_idx on public.trade_tags(tag_id);

create table public.journal_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  journal_date date not null,

  premarket_notes text,
  postmarket_notes text,
  lessons text,

  mood smallint check (mood between 1 and 5),
  focus smallint check (focus between 1 and 5),
  discipline smallint check (discipline between 1 and 5),
  sleep_hours numeric(4,2) check (sleep_hours is null or (sleep_hours >= 0 and sleep_hours <= 24)),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index journal_days_user_id_idx on public.journal_days(user_id);
create index journal_days_date_idx on public.journal_days(journal_date desc);
create unique index journal_days_user_date_unique
  on public.journal_days(user_id, journal_date)
  where user_id is not null;
create unique index journal_days_single_user_date_unique
  on public.journal_days(journal_date)
  where user_id is null;

create trigger journal_days_set_updated_at
before update on public.journal_days
for each row execute function public.set_updated_at();

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  trade_id uuid references public.trades(id) on delete cascade,
  journal_day_id uuid references public.journal_days(id) on delete cascade,

  bucket text not null default 'journal-media',
  storage_path text not null,
  file_name text,
  mime_type text,
  caption text,
  created_at timestamptz not null default now(),

  check (num_nonnulls(trade_id, journal_day_id) = 1)
);

create index attachments_user_id_idx on public.attachments(user_id);
create index attachments_trade_id_idx on public.attachments(trade_id);
create index attachments_journal_day_id_idx on public.attachments(journal_day_id);

alter table public.accounts enable row level security;
alter table public.strategies enable row level security;
alter table public.trades enable row level security;
alter table public.executions enable row level security;
alter table public.trade_metrics enable row level security;
alter table public.tags enable row level security;
alter table public.trade_tags enable row level security;
alter table public.journal_days enable row level security;
alter table public.attachments enable row level security;

grant select, insert, update, delete on public.accounts to authenticated;
grant select, insert, update, delete on public.strategies to authenticated;
grant select, insert, update, delete on public.trades to authenticated;
grant select, insert, update, delete on public.executions to authenticated;
grant select, insert, update, delete on public.trade_metrics to authenticated;
grant select, insert, update, delete on public.tags to authenticated;
grant select, insert, update, delete on public.trade_tags to authenticated;
grant select, insert, update, delete on public.journal_days to authenticated;
grant select, insert, update, delete on public.attachments to authenticated;

create policy "accounts_owner_all"
on public.accounts for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "strategies_owner_all"
on public.strategies for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "trades_owner_all"
on public.trades for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "executions_owner_all"
on public.executions for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "trade_metrics_owner_all"
on public.trade_metrics for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "tags_owner_all"
on public.tags for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "trade_tags_owner_all"
on public.trade_tags for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "journal_days_owner_all"
on public.journal_days for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "attachments_owner_all"
on public.attachments for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
