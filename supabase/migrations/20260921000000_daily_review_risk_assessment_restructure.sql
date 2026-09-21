-- Daily Review restructure ("Anpassungen Daily Journal", 2026-09-21):
--   - Block 1 "Kopf" renamed to "Risk Assessment" (app-layer only, no
--     schema change) + a new Traktion field.
--   - Block 2 "Plan & Gedankengänge" and the old standalone Block 3
--     "Marktumgebung" merge into one field; the standalone block goes
--     away. session_plan absorbs market_context's content, then
--     market_context is dropped.
--   - New "Portfolio Management" field (existing-position actions,
--     freeform) and a new "Post-Session-Review" field at the top of
--     Fazit.
--   - Ticker-Karten simplify to new-position-only fields: adds
--     weitere_these. management/stop_now/my_thinking are dropped from
--     app use but NOT from the table — confirmed via a live count
--     before this migration: daily_review_trades has real data in all
--     three (10/3/5 non-null rows out of 36), so they're left in place
--     as orphaned columns, same precedent as daily_reviews.gameplan,
--     rather than destroyed.
--
-- Confirmed via a live count before this migration: daily_reviews has
-- 15 rows, 9 with market_context and 9 with session_plan (8 with both)
-- — real data, so market_context's content is appended into
-- session_plan below before the column is dropped, not discarded.

alter table public.daily_reviews add column traction_recent_trades text;
alter table public.daily_reviews add column portfolio_management text;
alter table public.daily_reviews add column post_session_review text;

update public.daily_reviews
set session_plan = coalesce(session_plan, '') ||
  (case when session_plan is not null then E'\n\n' else '' end) ||
  'Marktumgebung: ' || market_context
where market_context is not null;

alter table public.daily_reviews drop column market_context;

alter table public.daily_review_trades add column weitere_these text;
