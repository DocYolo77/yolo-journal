-- Journal OS V7.4.3 web migration — Daily Review additions.
--
-- 1. portfolio_comment: a third free-text box at the top of the Daily
--    Review ("Portfolio / Neue Positionen" — Kommentar zum Portfolio,
--    Partials, Stops), alongside the existing Sessionverlauf/
--    Marktumgebung boxes (market_thought/market_environment).
-- 2. manual_portfolio_positions: manual override for the Portfolio
--    position table shown on the Daily Review, for when the automatic
--    IBKR sync doesn't reflect the real portfolio correctly. Same shape
--    as the broker_positions_snapshots read model (symbol, quantity,
--    average_price, market_price, unrealized_pnl, currency) — jsonb per
--    the same "no extra tables when jsonb suffices" pattern the rest of
--    this table already uses (guardrails/mental/ticker_reviews/
--    operational_todos).
--
-- Additive only.

alter table public.daily_reviews
  add column portfolio_comment text,
  add column manual_portfolio_positions jsonb not null default '[]'::jsonb;
