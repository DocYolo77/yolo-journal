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

Weekly Review and the Archive are still live but were deliberately left untouched by the v2
rewrite (see "Weekly Review is out of scope" below) — they will get their own separate rework
later. Monthly Review and Rules & Timeline remain unbuilt placeholders, same as before.

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

- `daily_reviews` — one row per `trade_date`, every field but `trade_date` optional. Has an
  orphaned `gameplan` column left over from pre-v2.1 (see Product invariants below) — nothing
  reads or writes it; don't resurrect it as a separate field.
- `daily_review_watchlist` — ticker chips, one list per day (no `scope` split as of v2.1 —
  that column was dropped), carries `taken` and `note` directly (this **is** the Shadowlist's
  data source — there is no separate shadowlist table).
- `daily_review_trades` — repeatable trade cards, all free text, no enums.
- `daily_review_guardrails` — a fixed nine-key click-list, default state is *absent* (no row),
  not "held."

**Weekly Review is out of scope for v2 and reads a separate, older data shape on purpose:**
`lib/weekly-review/{fetch,compute}.ts` still query `commitments`, `campaigns`,
`campaign_executions`, `broker_executions`, `broker_account_snapshots`,
`broker_positions_snapshots`, `daily_report_snapshots` (all still present, untouched, in the
database — the v2 spec's literal "drop everything" instruction was overridden for these
specific tables precisely because Weekly Review needs them) and the renamed
`daily_reviews_legacy` / `shadowlist_decisions_legacy` tables (pure renames of the pre-v2
`daily_reviews` / `shadowlist_decisions` tables — same data, same shape, only the table name
changed so the clean names were free for the new v2 schema). **Do not touch any of these eight
tables, or `lib/weekly-review/*`, `lib/campaigns/realized-pnl.ts`, or
`lib/weekly-review/legacy-guardrails.ts`, without first re-deciding Weekly Review's own rework
as its own explicit task.** They are dead weight from the Daily Review's perspective but load-
bearing for Weekly Review.

## Product invariants (v2)

- Every field except `trade_date` is optional. Empty fields never appear in exports.
- Autosave per field on an ~800ms debounce. No submit button, no required-field validation
  gate, one shared save-status indicator.
- Setup / Trigger-Taktik / Stop-Logik on trade cards are free text with autocomplete from the
  user's own history — never a dropdown or enum. Setup vocabulary changes faster than any
  enum could track.
- Shadow-text placeholders (the exact German prompts in `lib/validation/daily-review.ts`'s
  `SHADOW_TEXTS`) are prompts, not labels — they vanish on typing and are never persisted.
  Don't paraphrase them if you touch this file; the wording is deliberate.
- Guardrails are a fixed nine-key click-list, four states (Eingehalten / Verletzt / Bewusster
  Override / n. a.), default empty. This is documentation, not enforcement — nothing is
  blocked, nothing is validated, no note is derived from a status.
- The page is opened twice on the same trade_date, same row both times: in the morning for
  the Kopf watchlist and "Plan & Gedankengänge für die heutige Session" block (`session_plan` +
  `opportunity_spike`), in the evening for Marktumgebung, Persönliche Lage/Mentales,
  Ticker-Karten, and Fazit. No lock, no time gate — every block stays editable all day; the
  morning plan can still be changed in the evening, and that's fine (v2.1 removed the earlier
  watchlist-prefill/carry-forward mechanic entirely — there is no more "tomorrow's watchlist"
  concept and no cross-day copy).
- The Markdown export ("Für Claude kopieren") is the most important output of the page: fixed
  section order, empty fields/sections omitted entirely, no interpretation or summarization.
  Treat any change to its format as a breaking change to something else (an LLM chat) that
  depends on it staying stable week to week.
- The PDF export is the archive/snapshot mechanism now — there is no separate finalized
  snapshot row. Filename convention: `Daily_Review_YYYY-MM-DD.pdf`.
- `nlv_close` is optional by design — the value is meant to be pulled live from the broker in
  the LLM chat, not hand-typed here.

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

1. Check whether Weekly Review (`lib/weekly-review/*`) reads it, directly or through
   `lib/campaigns/realized-pnl.ts`. If it does, do not drop or reshape it without first
   reconciling that dependency (rename-and-recreate under the old name, same as the v2
   migration did, is usually the right move rather than breaking Weekly Review).
2. Show the proposal before applying destructive schema changes.
3. Back up affected data first if it's non-trivial and irreversible.

## Safety

Never:

- commit `.env.local`
- expose `SUPABASE_SECRET_KEY`
- import the secret-key client into Client Components
- log secrets
- rewrite migration history
- silently overwrite locked historical decisions (there is no more "locked" concept in v2,
  but this still applies to Weekly Review's `weekly_reviews`/`weekly_report_snapshots`
  FINAL state)

## Working principle

> Reproduce the real Journal OS first. Improve it later.

This principle guided the original V7.4.3 migration. It has been superseded for the Daily
Review by the v2 capture-tool direction above — do not resurrect the old Commitment/Lock/
IBKR-reconcile invariants there. It still applies, unchanged, to Weekly Review and Monthly
Review until they get their own explicit rework.
