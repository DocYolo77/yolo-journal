-- Replaces the Ticker-Karten repeatable-card UI with one freeform field
-- on daily_reviews, same shape as portfolio_management — the user just
-- dumps tickers + theses + thoughts as they come, an LLM sorts it out
-- later with real prices.
--
-- Cutover, not retroactive: confirmed via a live count before this
-- migration — daily_review_trades has 74 real rows, activity through
-- 2026-10-06 — so trade_date < 2026-10-08 (TRADES_FREITEXT_CUTOVER_DATE
-- in lib/validation/daily-review.ts) keeps rendering the existing
-- Ticker-Karten exactly as before (table untouched, nothing dropped);
-- trade_date >= 2026-10-08 uses this new field instead.

alter table public.daily_reviews add column trades_notes text;
