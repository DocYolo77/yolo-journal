-- Weekly Review Block 6 ("Shadowlist Auswertung der gesamten Woche") —
-- fills in the numbering gap the 2026-09-13 rewrite deliberately left
-- open. Same pure-capture shape as every other block: flat free-text
-- columns on weekly_reviews, no computed fields, nothing derived.

alter table public.weekly_reviews add column shadowlist_ticker text;
alter table public.weekly_reviews add column daily_selection text;
alter table public.weekly_reviews add column weekly_leadership text;
alter table public.weekly_reviews add column diskretion_vs_random text;
alter table public.weekly_reviews add column hauptbefund text;
alter table public.weekly_reviews add column research_fragen text;
