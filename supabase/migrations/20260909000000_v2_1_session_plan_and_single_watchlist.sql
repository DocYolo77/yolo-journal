-- v2.1 delta ("Änderung v2.1"): the Ausblick block moves from position
-- 6 (describing tomorrow's session) to position 2 (describing today's
-- session, filled in the morning). The watchlist is no longer split
-- into today/next — one list per day, entered in the morning. The
-- carry-forward prefill mechanic (§3.1a of the original v2 spec) is
-- removed entirely, not replaced.
--
-- Confirmed via a live row-count check before this migration: zero
-- scope='next' rows exist in daily_review_watchlist (only 18
-- scope='today' rows), so dropping the column loses nothing — the
-- spec's own fallback ("Verwerfen vertretbar") doesn't even come into
-- play here.

alter table public.daily_reviews rename column next_session_plan to session_plan;

alter table public.daily_review_watchlist drop column scope;
