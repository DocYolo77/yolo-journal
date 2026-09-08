-- Follow-up to the v2 capture-tool rewrite per the updated
-- Umbau-Anweisung v2 spec:
--
-- - daily_reviews gains opportunity_spike (§3.1a/§6, the Ausblick
--   block's pre-declared condition for taking extra risk tomorrow).
-- - daily_review_trades gains management ("Management heute") and
--   stop_now ("Stop jetzt") — the spec renames the block from
--   "Trade-Karten" to "Ticker-Karten": one card per ticker touched
--   today, entry and/or management of an existing position, rather
--   than a separate card type for management. stop_now is a
--   change-only field — empty means "unverändert", not "kein Stop".
-- - daily_review_guardrails.notes is renamed to note (singular) to
--   match the spec's own SQL sketch, same correction already applied
--   to daily_review_watchlist in 20260908020000.

alter table public.daily_reviews add column opportunity_spike text;

alter table public.daily_review_trades add column management text;
alter table public.daily_review_trades add column stop_now text;

alter table public.daily_review_guardrails rename column notes to note;
