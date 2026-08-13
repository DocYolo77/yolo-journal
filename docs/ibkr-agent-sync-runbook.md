# IBKR Agent Sync — Runbook

## Why this exists as a runbook, not a server integration

The `Interactive_Brokers_IBKR` MCP connector is authorized to a **Claude
session**, not to the deployed Next.js app. There is no way for a Next.js
server route to call `mcp__Interactive_Brokers_IBKR__*` tools directly —
those only exist inside an agent's own tool-calling turn.

Per the user's explicit choice (over building against the unverified IBKR
Flex Web Service XML format), the sync runs as a **scheduled Claude agent
turn** that calls the MCP tools itself, normalizes the results with
`web/src/lib/broker/ibkr-mcp-normalize.ts`, and writes to Supabase using
the same `getSupabaseAdmin()` service-role client the app itself uses.

## What a sync run does, step by step

1. Call `mcp__Interactive_Brokers_IBKR__get_account_trades` with an
   appropriate `period` (e.g. `DAYS_7` for a daily catch-up sync, `DAYS_90`
   for a backfill). Response can be large (six-figure character counts for
   a wide period) — read it from the saved tool-result file in chunks if
   it exceeds the inline limit, not by narrowing the period until it fits.
2. Call `get_account_summary` and `get_account_balances`.
3. Insert a `broker_sync_runs` row first (`status: 'running'`,
   `source_period_start/end` from the requested period), so a crash
   mid-run is still visible in the audit trail.
4. For each trade: run `normalizeIbkrTrade()`, then
   `insert ... on conflict (provider, dedup_key) do nothing` into
   `broker_executions`. Count `rows_inserted` vs `rows_skipped`
   (duplicates) — a repeated sync over overlapping periods must be a
   no-op for trades already imported, never a duplicate row.
5. Run `normalizeIbkrAccountSnapshot()` with the `providerAccountId` the
   user has configured (see "Open question" below — no MCP tool exposes
   this, so it isn't in the normalizer's output on its own), insert into
   `broker_account_snapshots`.
6. Update the `broker_sync_runs` row: `completed_at`, `status` (`success`
   / `partial` if some rows failed / `failed`), and the row counts.
7. Do **not** attempt Shadowlist auto-override or campaign reconciliation
   in the same run yet — those are separate, not-yet-built phases
   (`getOrCreateShadowlistDecisions` in `web/src/lib/data/shadowlist.ts`
   already has a comment marking exactly where the override belongs once
   this sync is live).

## Known gaps in the normalized data (see code comments for detail)

`normalizeIbkrAccountSnapshot()` leaves several architecture-required
fields `null` because no verified IBKR MCP response supplies them:
`start_of_day_nlv`, `net_exposure_pct`, `realized_pnl_day`,
`unrealized_pnl_day`. `gross_exposure_pct` is derived
(`gross_position_value / net_liquidation_value`) and was cross-checked
against IBKR's own reported `leverage` field on real account data — that
one is trustworthy. The others are not fabricated; they stay null until a
verified source is found (e.g. a different IBKR endpoint, or accepting an
approximation and documenting it explicitly first).

## Open question before this can actually run unattended

`provider_account_id` has no source in any MCP response captured so far —
the connector is implicitly scoped to a single account. A sync run needs
this supplied from configuration (e.g. an env var or a value the user
states once), not guessed.

## Prerequisites not yet in place

- A Supabase service-role key reachable from wherever the scheduled agent
  turn executes (this sandbox intentionally has none — same constraint as
  the rest of this project).
- A decision on cadence (after close daily? on-demand only while this is
  new?) and which environment/session the Routine fires into.
