-- Weekly Review v2 rewrite ("Update der Seite Weekly Review", 12.09.2026).
--
-- Same philosophy shift v2/v2.1 already applied to the Daily Review: the
-- page stops computing anything (Kennzahlen, Guardrail-Auswertung, Shadow
-- Log, R-Ergebnisse) — that judgment now happens in an LLM chat fed by
-- IBKR data and the week's Daily Reviews. This page only captures what
-- exists purely in Phil's head. Confirmed via a live row-count check
-- before this migration: both weekly_reviews and weekly_report_snapshots
-- have zero rows, so there is nothing to preserve or migrate forward.
--
-- The finalize/snapshot mechanic (DRAFT/FINAL, weekly_report_snapshots,
-- the immutable report) is removed entirely along with it — like the
-- Daily Review, a Weekly Review is now always editable, and there is no
-- separate finalized state.
--
-- The eight legacy tables Weekly Review used to aggregate from
-- (commitments, campaigns, campaign_executions, broker_executions,
-- broker_account_snapshots, broker_positions_snapshots,
-- daily_report_snapshots, daily_reviews_legacy, shadowlist_decisions_legacy)
-- are deliberately left untouched — nothing here reads them anymore, but
-- dropping them is a separate decision this migration does not make.

drop table if exists public.weekly_report_snapshots;
drop table if exists public.weekly_reviews;

create table public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,

  iso_year integer not null,
  iso_week integer not null,
  week_start date not null,
  week_end date not null,

  -- Block 1 — Zahlen & Guardrails (bewusst nur ein Freitextfeld; Zahlen
  -- und Guardrail-Bilanz entstehen künftig in der Review-Instanz).
  brueche text,

  -- Block 2 — Markt der Woche.
  regime text check (regime in ('Strong Uptrend', 'Uptrend', 'Choppy/Mixed', 'Downtrend', 'Strong Downtrend')),
  bias_flip boolean,
  bias_flip_text text,
  leadership text,
  satz_der_woche text,

  -- Block 3 — Mentaler Zustand.
  mental_tags text[] not null default '{}',
  fokus numeric,
  mental_text text,

  -- Block 5 — Universum & Coverage (fünf kommagetrennte Freitextfelder,
  -- keine Einzelfelder pro Name).
  staerkste_namen text,
  gehandelt text,
  nicht_gehandelt text,
  verpasst text,
  guter_skip text,

  -- Block 7 footer — Freitext nach den Missed-Review-Karten.
  gemeinsame_eigenschaften text,

  -- Block 8 — Demon Finder footer (die acht festen Zeilen selbst sind
  -- weekly_review_demons, siehe unten).
  worst_trade_ticker text,
  worst_trade_text text,
  wiederholung boolean,
  wiederholung_text text,

  -- Block 9 — Bester Prozess der Woche.
  good_trade_ticker text,
  good_trade_text text,

  -- Block 10 — Rollen-Check (genau drei feste Zeilen, deshalb flache
  -- Spalten statt einer Kindtabelle) & Self-Grade.
  rolle_stockpicker_ja_nein boolean,
  rolle_stockpicker_text text,
  rolle_allocator_ja_nein boolean,
  rolle_allocator_text text,
  rolle_operator_ja_nein boolean,
  rolle_operator_text text,
  self_grade text check (self_grade in ('1', '2', '3', '4', '5', '6')),
  self_grade_begruendung text,

  -- Block 11 — Die eine Regel für nächste Woche.
  regel text,
  regel_konkret text,
  regel_pruefung text,
  idea_capture text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (iso_year, iso_week)
);

create index weekly_reviews_week_start_idx on public.weekly_reviews(week_start desc);

create trigger weekly_reviews_set_updated_at
before update on public.weekly_reviews
for each row execute function public.set_updated_at();

-- Block 4 — Trade-Karten. Wiederholbar, eine Karte pro Ticker; Re-Entries
-- und Adds gehören in dieselbe Karte statt eine neue zu erzeugen.
create table public.weekly_review_trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  review_id uuid not null references public.weekly_reviews(id) on delete cascade,
  sort_order integer not null default 0,

  ticker text not null default '',
  seite text check (seite in ('Long', 'Short')),
  setup text,
  -- Named trigger_tactic, not trigger, matching daily_review_trades'
  -- existing column of the same meaning (and sidestepping "trigger" as a
  -- SQL keyword).
  trigger_tactic text,
  verlauf text,
  grade_selektion text check (grade_selektion in ('A', 'B', 'C', 'D')),
  grade_entry text check (grade_entry in ('A', 'B', 'C', 'D')),
  grade_management text check (grade_management in ('A', 'B', 'C', 'D')),
  prozess_vs_ergebnis text check (
    prozess_vs_ergebnis in ('gut trotz Verlust', 'schlecht trotz Gewinn', 'Ergebnis deckt sich mit Prozess')
  ),
  chart_url text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index weekly_review_trades_review_id_idx on public.weekly_review_trades(review_id);

create trigger weekly_review_trades_set_updated_at
before update on public.weekly_review_trades
for each row execute function public.set_updated_at();

-- Block 7 — Missed Reviews & A+ Pattern Recognition cards. Exactly three
-- elements per card per spec: ticker, chart_url, text.
create table public.weekly_review_missed (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  review_id uuid not null references public.weekly_reviews(id) on delete cascade,
  sort_order integer not null default 0,

  ticker text not null default '',
  chart_url text,
  text text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index weekly_review_missed_review_id_idx on public.weekly_review_missed(review_id);

create trigger weekly_review_missed_set_updated_at
before update on public.weekly_review_missed
for each row execute function public.set_updated_at();

-- Block 8 — Demon Finder's eight fixed rows. Same "default state is
-- absent, not a false/empty row" shape as daily_review_guardrails —
-- a row exists only once its checkbox or text has been touched.
create table public.weekly_review_demons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  review_id uuid not null references public.weekly_reviews(id) on delete cascade,
  demon_key text not null,
  aktiv boolean not null default false,
  text text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (review_id, demon_key)
);

create trigger weekly_review_demons_set_updated_at
before update on public.weekly_review_demons
for each row execute function public.set_updated_at();

-- ============================================================
-- RLS
-- ============================================================

alter table public.weekly_reviews enable row level security;
alter table public.weekly_review_trades enable row level security;
alter table public.weekly_review_missed enable row level security;
alter table public.weekly_review_demons enable row level security;

grant select, insert, update, delete on public.weekly_reviews to authenticated;
grant select, insert, update, delete on public.weekly_review_trades to authenticated;
grant select, insert, update, delete on public.weekly_review_missed to authenticated;
grant select, insert, update, delete on public.weekly_review_demons to authenticated;

create policy "weekly_reviews_owner_rw"
on public.weekly_reviews for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "weekly_review_trades_owner_rw"
on public.weekly_review_trades for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "weekly_review_missed_owner_rw"
on public.weekly_review_missed for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "weekly_review_demons_owner_rw"
on public.weekly_review_demons for all
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

grant select, insert, update, delete on public.weekly_reviews to service_role;
grant select, insert, update, delete on public.weekly_review_trades to service_role;
grant select, insert, update, delete on public.weekly_review_missed to service_role;
grant select, insert, update, delete on public.weekly_review_demons to service_role;
