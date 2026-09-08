-- Cosmetic correction: 20260908000000_v2_capture_tool_rewrite.sql
-- named this column `notes` (plural); the Umbau-Anweisung v2 spec's
-- own SQL sketch for daily_review_watchlist uses `note` (singular).
-- Table is still empty in production, so a straight rename is lossless.
alter table public.daily_review_watchlist rename column notes to note;
