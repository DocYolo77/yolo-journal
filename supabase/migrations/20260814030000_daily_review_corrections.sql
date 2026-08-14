-- Journal OS V7.4.3 web migration — Daily Review corrections.
--
-- Additive only.
--
-- guardrails_reviewed: explicit confirmation gate. All guardrails start
-- pre-marked "Eingehalten" in the UI, so this checkbox is the actual
-- signal that the trader looked at them before the review can be
-- finalized ("Review abschließen" in report-snapshot.ts refuses unless
-- this is true) — without it, a pre-filled "all good" default would be
-- meaningless.
--
-- shadowlist_comment: optional free-text commentary on why certain
-- Shadowlist names were not taken, separate from the per-ticker
-- Outcome/Notes field since it concerns selection across the whole
-- Shadowlist, not one traded ticker.

alter table public.daily_reviews
  add column guardrails_reviewed boolean not null default false,
  add column shadowlist_comment text;
