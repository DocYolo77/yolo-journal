# CLAUDE.md — yolo-journal

## STOP: corrected product definition

The previous generic Trading Journal specification was wrong.

This repository is a web migration of the user's existing **Journal OS V7.4.3**.

Read `LEGACY_JOURNAL_OS_V7_4_3_REFERENCE.md` in full before making further product changes. It is the canonical functional reference derived from the user's actual legacy codebase.

## Core workflow

Build around:

**Pre-Market Commitment → Lock → Shadowlist / Focus Audit → IBKR Reconcile → Daily Review → Weekly Review → Monthly Review → Archive / Rules Timeline**

Do not center the product around generic Trades / Accounts / Strategies CRUD.

## Existing work

Audit everything already built from the incorrect generic specification.

Classify it as:

- **KEEP** — technically and functionally useful for the real Journal OS
- **REPURPOSE** — useful implementation but wrong product framing
- **SCRAP** — only exists because of the wrong generic roadmap

Do not preserve incorrect UI or architecture merely because coding time has already been spent on it.

## Technical base to keep

- Next.js under `web/`
- Supabase
- server-side Supabase access
- `.env.local` remains local and uncommitted
- existing migration history remains immutable
- local health check was already proven: `{"ok":true,"trades":0}`

Your cloud/browser environment does not have the local secrets. Do not interpret that as a broken integration.

## Database rule

Do NOT alter existing migration files.

Before adding Journal-OS migrations:

1. inspect current schema and current implementation
2. read `LEGACY_JOURNAL_OS_V7_4_3_REFERENCE.md`
3. propose a relational mapping of the legacy data model
4. classify current tables as KEEP / REPURPOSE / DEPRECATE / NEW
5. show the proposal before applying destructive schema changes

## Product invariants

Must preserve:

- seven-section Pre-Market Commitment
- versioned commitment revisions
- irreversible lock semantics
- after lock, intraday risk can only decrease
- locked watchlist / EP candidates / hard rules cannot silently change
- max 3 traded tickers as a process guardrail
- Prime / Watchlist / Secondary source
- Shadowlist as a first-class stock-selection audit
- taken vs not taken
- M5 / M15 / M30 shadow model
- M30 committed focus audit
- strict trigger after completed opening range
- IBKR fills grouped into economic campaigns rather than treating clicks as trades
- old positions separated from same-day campaigns
- Daily Review against the locked premarket plan
- Selection / Execution / Management evaluated separately
- persistent loser/risk state
- guardrails
- mental status without invented psychological diagnoses
- Weekly Review
- Monthly Review
- archive and append-only audit timeline

## Immediate next action

Do not immediately continue coding.

First respond with:

### A. Current implementation audit
- KEEP
- REPURPOSE
- SCRAP

### B. Gap analysis against Journal OS V7.4.3

### C. Proposed target information architecture

### D. Proposed Supabase schema mapping
No migrations yet.

### E. Smallest safe next implementation phase

Only after the product/model audit is coherent should implementation resume.

## Safety

Never:

- commit `.env.local`
- expose `SUPABASE_SECRET_KEY`
- import the secret-key client into Client Components
- log secrets
- rewrite migration history
- silently overwrite locked historical decisions

## Working principle

> Reproduce the real Journal OS first. Improve it later.

Do not invent a new product.
