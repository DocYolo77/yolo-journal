# CLAUDE.md — yolo-journal

## Product direction: v2 — a capture tool, not an analysis tool

As of 2026-09-08 this repository implements the **"Umbau-Anweisung v2"** rewrite, which
supersedes the earlier Journal OS V7.4.3 web-migration spec (`LEGACY_JOURNAL_OS_V7_4_3_REFERENCE.md`
is now historical background only — do not treat it as the current target).

**Goal:** the Daily Review page stores inputs, renders charts, and produces exports. It does
not judge, does not enforce rules, and does not compute derived metrics.

> Wenn ein Feld auf eine Auswertung wartet, die die Seite nicht liefern kann, gehört es nicht
> ins Formular. (If a field is waiting on an evaluation the page can't deliver, it doesn't
> belong in the form.)

The judgment/analysis that the old Commitment/Lock/IBKR-reconcile system used to attempt now
happens in an LLM chat, fed by the Daily Review's Markdown export plus live broker/market data
pulled at chat time. Do not re-add broker reconstruction, R-calculation, guardrail enforcement,
sizing control, traction analysis, portfolio EMA10, index-extension warnings, coach-fazit, or
process notes to the app itself — that is deliberately out of scope now.

## Core workflow (current)

**Daily Review (single page, always editable) → Shadowlist (decoupled) → Markdown export
("Für Claude kopieren") / PDF export**

**Weekly Review (single page, always editable) → Markdown export ("Für Claude kopieren")**,
same capture-only philosophy as Daily Review — see "Weekly Review v2" below. This was the
explicit rework the original v2 spec deferred; it's done now (as of 2026-09-13), not still
pending. The Archive is still live and lists both. Monthly Review and Rules & Timeline remain
unbuilt placeholders, same as before.

## What was removed in v2 (do not re-add without a fresh product decision)

- The Pre-Market Commitment workflow: the form, versioned revisions, DRAFT/LOCKED status,
  lock semantics, "risk can only decrease after lock," the risk-reduction workflow.
- Both IBKR ingestion paths: the Flex Web Service sync and the manual JSON import, plus the
  campaign-reconciliation engine, EOD-consistency checks, and reversal-flagging.
- `audit_events` — the hash-chained event ledger. It never successfully wrote a row in
  production; immutability now comes from the exported PDF, not a log.
- The old finalized-report system (`daily_report_snapshots`-backed, one row per trade_date,
  DRAFT/FINAL). A Daily Review is now always editable; there is no separate "final" state.
- The old Shadowlist decision model (list_type/decision/reason enums, commitment-linked,
  IBKR auto-override). Shadowlist is now a `taken` boolean + optional note directly on the
  review's own watchlist row — no separate table, no auto-override (there's no broker data
  left to auto-override from).

## Current data model

One main table plus three child tables (all under `daily_reviews`'s new v2 shape — see
`supabase/migrations/20260908000000_v2_capture_tool_rewrite.sql` for the authoritative
definitions and `web/src/lib/supabase/types.ts` for the hand-written TS mirror):

- `daily_reviews` — one row per `trade_date`, every field but `trade_date` optional. Has two
  orphaned columns nothing reads or writes anymore — `gameplan` (pre-v2.1) and, as of
  2026-09-21, `market_context` (dropped outright; its content was folded into `session_plan`
  by the migration, see Product invariants below) — don't resurrect either as a separate field.
- `daily_review_watchlist` — ticker chips, one list per day (no `scope` split as of v2.1 —
  that column was dropped), carries `taken` and `note` directly (this **is** the Shadowlist's
  data source — there is no separate shadowlist table). As of 2026-09-21 it also feeds Weekly
  Review's `shadowlist_ticker` (see "Weekly Review v2" below).
- `daily_review_trades` — repeatable trade cards, new-position entries only as of 2026-09-21
  (existing-position management moved to `daily_reviews.portfolio_management`), all free text,
  no enums. `management`/`stop_now`/`my_thinking` are orphaned columns with real historical
  data — left in place, not read or written anymore, same precedent as `gameplan`. As of
  2026-09-22, `setup`/`trigger_tactic`/`stop_logic` are *also* legacy-only (still live, but
  only for `trade_date < 2026-09-22`) — see the Setup-merge invariant below for the cutover
  and `setup_taktik_stop`, the merged field new cards use instead.
- `daily_review_guardrails` — a fixed nine-key click-list, default state is *absent* (no row),
  not "held."

## Weekly Review v2

As of 2026-09-13, Weekly Review got the same rework Daily Review got in the original v2 spec:
the page stopped computing anything (no Kennzahlen, no Guardrail-Auswertung, no Shadow Log, no
R-Ergebnisse) and now only captures what exists purely in the user's own head — the analysis
happens in an LLM chat instead, fed by the week's Daily Review Markdown exports plus live
IBKR/market data. The old aggregation engine (`lib/weekly-review/{aggregate,compute,fetch,
repetition,legacy-guardrails}.ts`, `lib/campaigns/realized-pnl.ts`), the DRAFT/FINAL finalize
flow, and `weekly_report_snapshots` are gone entirely — same "always editable, no separate
final state" model as Daily Review, no PDF export (only "Für Claude kopieren" — the spec never
asked for one).

`weekly_reviews` (one row per ISO calendar week, keyed on `(iso_year, iso_week)`) plus three
child tables — `weekly_review_trades` (repeatable Trade-Karten), `weekly_review_missed`
(repeatable Missed-Review/A+ Pattern Recognition cards), and `weekly_review_demons` (the Demon
Finder's eight fixed rows, same "default state is absent" pattern as `daily_review_guardrails`)
— see `supabase/migrations/20260913000000_weekly_review_v2_rewrite.sql` for the authoritative
shape and `web/src/lib/supabase/types.ts` for the hand-written TS mirror. Both `weekly_reviews`
and `weekly_report_snapshots` had zero rows in production when this migration dropped and
recreated them, so nothing needed to be preserved or migrated forward.

The eight/nine tables Weekly Review used to read (`commitments`, `campaigns`,
`campaign_executions`, `broker_executions`, `broker_account_snapshots`,
`broker_positions_snapshots`, `daily_report_snapshots`, `daily_reviews_legacy`,
`shadowlist_decisions_legacy`) are now fully orphaned — nothing in the app reads them anymore.
They are deliberately left untouched in the database; dropping them is a separate decision
nobody has made yet, not an oversight.

**Block 6 update (2026-09-19):** the "Shadow Log" numbering gap the 2026-09-13 rewrite left
open is now filled — not with computation, but with six more flat free-text fields on
`weekly_reviews` (`shadowlist_ticker`, `daily_selection`, `weekly_leadership`,
`diskretion_vs_random`, `hauptbefund`, `research_fragen`, see
`supabase/migrations/20260919000000_weekly_review_block6_shadow_log.sql`). The user pastes
the week's shadowlist tickers and their own manual analysis of it by hand; the page still
computes nothing itself.

**Watchlist → Shadowlist link (2026-09-21):** `shadowlist_ticker` is prefilled once, at
row-creation time, from the distinct `daily_review_watchlist` tickers across that ISO week's
Daily Reviews (`getWatchlistTickersForWeek`/`getOrCreateWeeklyReview` in
`lib/data/weekly-review.ts`) — a one-time convenience, never silently overwriting a later
manual edit. An "Aus Watchlist übernehmen" button next to the field re-pulls and overwrites on
demand (`syncShadowlistTickerFromWatchlist`), for when the watchlist changed after the row was
first created.

## Product invariants (v2)

- Every field except `trade_date` is optional. Empty fields never appear in exports.
- Autosave per field on an ~800ms debounce. No submit button, no required-field validation
  gate, one shared save-status indicator.
- Setup / Trigger-Taktik / Stop-Logik on legacy trade cards (`trade_date < 2026-09-22`, see the
  Setup-merge invariant below) are free text with autocomplete from the user's own history —
  never a dropdown or enum. Setup vocabulary changes faster than any enum could track.
- Shadow-text placeholders (the exact German prompts in `lib/validation/daily-review.ts`'s
  `SHADOW_TEXTS`) are prompts, not labels — they vanish on typing and are never persisted.
  Don't paraphrase them if you touch this file; the wording is deliberate.
- Guardrails are a fixed nine-key click-list, four states (Eingehalten / Verletzt / Bewusster
  Override / n. a.), default empty. This is documentation, not enforcement — nothing is
  blocked, nothing is validated, no note is derived from a status.
- The page is opened twice on the same trade_date, same row both times: in the morning for
  the Risk Assessment watchlist and "Plan, Gedankengänge & Marktumgebung" block (`session_plan`
  + `opportunity_spike`), in the evening for Persönliche Lage/Mentales, Ticker-Karten,
  Portfolio Management, and Fazit. No lock, no time gate — every block stays editable all day;
  the morning plan can still be changed in the evening, and that's fine (v2.1 removed the
  earlier watchlist-prefill/carry-forward mechanic entirely — there is no more "tomorrow's
  watchlist" concept and no cross-day copy).
- **2026-09-21 restructure:** Block 1 "Kopf" renamed to "Risk Assessment" (+ new
  `traction_recent_trades` field). Block 2 absorbed the old standalone Block 3 "Marktumgebung"
  into one merged `session_plan` field titled "Plan, Gedankengänge & Marktumgebung" — that
  standalone block is gone, and every block after it shifted down by one number. A
  presentational "Trading Session" divider (no number, no data) sits before Ticker-Karten;
  Ticker-Karten itself is now new-position-entries only (`weitere_these` replaces the removed
  Management/Stop-jetzt/Meine-Denke fields — see "Current data model" above for what happened
  to those columns), with a "Neue Position" dropdown above the card list. A new numbered block
  "Portfolio Management" (`portfolio_management`, freeform) follows, for existing-position
  actions that used to live on the trade cards. A "Postmarket" divider precedes Fazit, which
  now opens with a new unstructured `post_session_review` field ahead of the three existing
  Was-lief-gut/nicht-gut/besser fields.
- **2026-09-22 Setup merge (cutover, not retroactive):** trade cards on `trade_date >=
  SETUP_MERGE_CUTOVER_DATE` ("2026-09-22", `lib/validation/daily-review.ts`) get one merged
  "Setup / Taktik / Stop Placement" field (`setup_taktik_stop`) instead of three separate ones.
  Cards on 2026-09-21 or earlier keep the legacy three-field layout (`setup`/`trigger_tactic`/
  `stop_logic`) untouched, since real data already existed there — the user asked explicitly
  for a cutover, not a merge-and-migrate. `TradeCard` in `daily-review-form.tsx` picks the
  layout per-card from its review's `trade_date`; the Markdown/PDF exports check
  `setup_taktik_stop` first and fall back to the three legacy fields. No autocomplete on the
  merged field (unlike the legacy three) — a full paragraph doesn't suggest well from history.
- The Markdown export ("Für Claude kopieren") is the most important output of the page: fixed
  section order, empty fields/sections omitted entirely, no interpretation or summarization.
  Treat any change to its format as a breaking change to something else (an LLM chat) that
  depends on it staying stable week to week.
- The PDF export is the archive/snapshot mechanism now — there is no separate finalized
  snapshot row. Filename convention: `Daily_Review_YYYY-MM-DD.pdf`.
- `nlv_close` is optional by design — the value is meant to be pulled live from the broker in
  the LLM chat, not hand-typed here.
- Weekly Review follows the identical autosave/no-lock/Markdown-export model — see "Weekly
  Review v2" above. Ticker fields there get autocomplete from history (Daily Review's own
  trades plus past Weekly cards); every other field is free text or one of the fixed option
  lists in `lib/validation/weekly-review.ts`, never a rebuilt enum.

## Technical base

- Next.js under `web/`
- Supabase, server-side access only (never import the secret-key client into Client Components)
- `.env.local` remains local and uncommitted
- Hand-written types in `web/src/lib/supabase/types.ts` — no ORM/codegen, keep in sync
  manually whenever a migration changes a table
- Your cloud/browser environment does not have the local secrets; that is expected, not a
  broken integration

## Database rule

Do NOT alter existing migration files — new schema changes are always a new migration file,
never an edit to a committed one. Before dropping or restructuring any table:

1. Show the proposal before applying destructive schema changes.
2. Back up affected data first if it's non-trivial and irreversible — or confirm via a live
   row-count query that there's nothing to preserve, same check done before both the v2 Daily
   Review rewrite and the Weekly Review v2 rewrite.
3. The nine now-orphaned legacy tables (`commitments`, `campaigns`, `campaign_executions`,
   `broker_executions`, `broker_account_snapshots`, `broker_positions_snapshots`,
   `daily_report_snapshots`, `daily_reviews_legacy`, `shadowlist_decisions_legacy`) are nobody's
   dependency anymore, but dropping them is still a separate, explicit decision — not something
   to do as a drive-by cleanup on an unrelated task.

## Safety

Never:

- commit `.env.local`
- expose `SUPABASE_SECRET_KEY`
- import the secret-key client into Client Components
- log secrets
- rewrite migration history
- silently overwrite locked historical decisions (there is no more "locked"/FINAL concept
  anywhere in the app now — Daily Review and Weekly Review are both always editable)

## Working principle

> Reproduce the real Journal OS first. Improve it later.

This principle guided the original V7.4.3 migration. It has been superseded for Daily Review
and Weekly Review by the v2 capture-tool direction above — do not resurrect the old Commitment/
Lock/IBKR-reconcile invariants there. It still applies, unchanged, to Monthly Review until it
gets its own explicit rework.
