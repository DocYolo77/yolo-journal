-- Merges the trade card's Setup / Taktik / Stop Placement inputs into
-- one free-text field, per the user's explicit request. Cutover, not
-- retroactive: today (2026-09-21) and every earlier session already has
-- real data typed into the three separate columns, so those stay
-- exactly as they are and the app renders them in a "legacy" three-field
-- layout for trade_date <= 2026-09-21 (see
-- lib/validation/daily-review.ts's SETUP_MERGE_CUTOVER_DATE). Only
-- trade_date >= 2026-09-22 uses the new merged column.
--
-- setup/trigger_tactic/stop_logic are NOT dropped or touched — they stay
-- live for legacy cards, unlike the earlier management/stop_now/
-- my_thinking orphaning (those had no forward use at all; these three
-- still do, for existing dates).

alter table public.daily_review_trades add column setup_taktik_stop text;
