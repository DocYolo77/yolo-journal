-- Crypto journal — deliberately separate and much lighter than the
-- stock Aktienjournal (no daily Pre-Market Commitment/Lock/Shadowlist
-- workflow applies here). Each crypto trade is its own standalone
-- entity: log it, manage it, close it, extract a lesson, done.
--
-- Three tables:
--   crypto_trades     — one row per trade, OPEN while being managed,
--                       CLOSED once done. Deliberately thin: no entry/
--                       stop/exit price or position-size columns, since
--                       those are already visible on the entry/after
--                       screenshots (screenshot paths, not raw images,
--                       are stored here — the actual files live in the
--                       "crypto-screenshots" Storage bucket, created
--                       lazily in app code the same way
--                       app/reports/daily/[date]/pdf/route.tsx lazily
--                       creates the "reports" bucket).
--   crypto_learnings  — the central, tag-only (no fixed categories)
--                       Learning Card collection. Each card keeps its
--                       link back to the originating trade
--                       (trade_id, on delete set null so the card
--                       survives a deleted trade) plus a denormalized
--                       trade_date/coin snapshot so the card still
--                       displays correctly if the origin trade is ever
--                       removed.
--   crypto_weekly_reviews — one freeform row per week (good/bad/
--                       learned/focus) exactly like weekly_reviews;
--                       trade count/PnL$/PnL R are computed live from
--                       crypto_trades, never persisted here, same
--                       "single source of truth" principle as the stock
--                       Weekly Review's own aggregation.
--
-- Additive only.

create table public.crypto_trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,

  trade_date date not null,
  coin text not null,
  direction text not null check (direction in ('LONG', 'SHORT')),
  product text not null check (product in ('SPOT', 'PERP')),

  risk_usd numeric,
  risk_pct numeric,
  result_usd numeric,
  result_r numeric,

  entry_screenshot_path text,
  after_screenshot_path text,

  thesis text,
  management text,

  review_good text,
  review_bad text,
  review_better text,
  lesson text,

  status text not null default 'OPEN' check (status in ('OPEN', 'CLOSED')),
  closed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index crypto_trades_trade_date_idx on public.crypto_trades(trade_date desc);
create index crypto_trades_status_idx on public.crypto_trades(status);
create index crypto_trades_user_id_idx on public.crypto_trades(user_id);

create trigger crypto_trades_set_updated_at
before update on public.crypto_trades
for each row execute function public.set_updated_at();

create table public.crypto_learnings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,

  trade_id uuid references public.crypto_trades(id) on delete set null,
  lesson text not null,

  -- Denormalized from the origin trade at creation time so the card
  -- still shows its date/coin even if that trade is later deleted.
  trade_date date,
  coin text,

  tags text[] not null default '{}',

  -- Free reordering across the whole collection — no per-category
  -- scoping, since there are deliberately no fixed categories here.
  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index crypto_learnings_sort_idx on public.crypto_learnings(sort_order);
create index crypto_learnings_trade_id_idx on public.crypto_learnings(trade_id);
create index crypto_learnings_user_id_idx on public.crypto_learnings(user_id);

create trigger crypto_learnings_set_updated_at
before update on public.crypto_learnings
for each row execute function public.set_updated_at();

create table public.crypto_weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,

  week_start date not null,
  week_end date not null,

  good text,
  bad text,
  learned text,
  focus_next_week text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (week_start)
);

create index crypto_weekly_reviews_week_start_idx on public.crypto_weekly_reviews(week_start desc);

create trigger crypto_weekly_reviews_set_updated_at
before update on public.crypto_weekly_reviews
for each row execute function public.set_updated_at();

-- ============================================================
-- RLS
-- ============================================================

alter table public.crypto_trades enable row level security;
alter table public.crypto_learnings enable row level security;
alter table public.crypto_weekly_reviews enable row level security;

grant select, insert, update, delete on public.crypto_trades to authenticated;
grant select, insert, update, delete on public.crypto_learnings to authenticated;
grant select, insert, update on public.crypto_weekly_reviews to authenticated;

create policy "crypto_trades_owner_rw"
on public.crypto_trades for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "crypto_learnings_owner_rw"
on public.crypto_learnings for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "crypto_weekly_reviews_owner_rw"
on public.crypto_weekly_reviews for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

grant select, insert, update, delete on public.crypto_trades to service_role;
grant select, insert, update, delete on public.crypto_learnings to service_role;
grant select, insert, update on public.crypto_weekly_reviews to service_role;
