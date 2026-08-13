# IBKR Agent Sync — Runbook

## Why this exists as a runbook, not a server integration

The `Interactive_Brokers_IBKR` MCP connector is authorized to a **Claude
session**, not to the deployed Next.js app. There is no way for a Next.js
server route to call `mcp__Interactive_Brokers_IBKR__*` tools directly —
those only exist inside an agent's own tool-calling turn.

Per the user's explicit choice (over building against the unverified IBKR
Flex Web Service XML format), the sync runs as a **scheduled Claude agent
turn** — a Routine (`mcp__Claude_Code_Remote__create_trigger`) that calls
the MCP tools itself, normalizes the results with the exact same pure
functions the app ships (`web/src/lib/broker/ibkr-mcp-normalize.ts`,
`web/src/lib/campaigns/reconcile.ts`), and writes to Supabase via
`mcp__Supabase__execute_sql` (project `wrwbhvzcjnolixqiexpa`). Using the
Supabase MCP connector directly — rather than `getSupabaseAdmin()` with a
`SUPABASE_SECRET_KEY` env var — means the sync agent has no dependency on
that secret being present.

The two daily Routines (`ibkr-daily-sync-edt-slot`,
`ibkr-daily-sync-est-slot`) are **bound to this development session**
(`persistent_session_id`), not `create_new_session_on_fire`. That was the
original design, but this org rejects the `connectors` parameter on
`create_trigger` ("the connectors parameter is not available for this
organization") — a fresh-spawned session has no way to be granted the
Interactive_Brokers_IBKR / Supabase connectors at all, which would make
every firing fail immediately. Binding to this session instead means each
firing resumes a session that already holds both connector
authorizations. Tradeoff: the sync now shares this session's growing
conversation history rather than starting clean each time. If this
org-level restriction is later lifted, re-creating the Routines with
`create_new_session_on_fire: true` + `connectors: ["Interactive Brokers
(IBKR)", "Supabase"]` would be the cleaner long-term shape.

To keep the normalization/reconciliation math itself as a single source
of truth (never re-derived by hand in a prompt, never allowed to drift
from what the app's own build tests), the sync turn compiles and runs the
real `.ts` files with the same throwaway `tsc + node` pattern used to
test them during development: copy the file to a scratch dir, `npx tsc
<file> --module commonjs --target es2020 --outDir dist`, then feed it
JSON via a small driver script. It never hand-reimplements the
normalization logic in the prompt.

## Cadence — DST-safe without a hardcoded UTC offset

Preferred cadence: ~16:01 America/New_York, roughly one minute after RTH
close. `create_trigger`'s cron is **UTC-only with no IANA timezone
support and hourly-minimum granularity** — a single fixed UTC cron
expression would be correct for only half the year (EDT vs. EST) and
require manual toggling twice a year, which this project explicitly
avoids per the user's instruction: *"Wenn der Trigger keine
IANA-Zeitzone wie America/New_York unterstützt, keine fixe UTC-Zeit
hardcoden. Dokumentiere dann die Einschränkung und wähle eine
DST-taugliche Alternative."*

Resolution: **two** daily Routines, both firing the identical prompt:

| Routine | Cron (UTC) | Correct (fires ~16:01 ET) during |
|---|---|---|
| `ibkr-daily-sync-edt-slot` | `1 20 * * *` (20:01 UTC) | EDT (UTC-4), mid-March–early November |
| `ibkr-daily-sync-est-slot` | `1 21 * * *` (21:01 UTC) | EST (UTC-5), early November–mid-March |

Every firing starts with a **time guard**: `TZ=America/New_York date +%H`.
If the result is not `16`, that firing is the off-cycle half of the pair
for today's DST regime — it exits immediately as a no-op, before creating
any `broker_sync_runs` row or touching the database. Exactly one of the
two firings passes the guard on any given day, automatically flipping
across the DST boundary with zero manual toggling.

## Manual "Sync IBKR now" requests

The Shadowlist page has a "Sync IBKR now" button
(`web/src/components/broker/ibkr-sync-button.tsx`,
`requestIbkrSyncAction` in `web/src/app/shadowlist/actions.ts`). The
deployed Next.js app has the same fundamental limitation described above
— it cannot call the IBKR MCP connector itself — so the button only
inserts a `pending` row into `manual_sync_requests`
(`20260813193000_create_manual_sync_requests.sql`); it does not run a
sync immediately.

Both daily Routine prompts check for a pending `manual_sync_requests` row
**before** their DST time guard (Step -1, ahead of Step 0). If one
exists, that firing skips the time guard entirely and runs the full sync
regardless of time of day, then marks the request `status = 'completed'`
with `broker_sync_run_id` pointing at the resulting run (or, if IBKR
needs re-authorization, still marks it `completed` linked to the
`failed` run — a request should never sit `picked_up` forever with
nothing to show for it). This means a manual request is picked up at the
*next* of the two daily firings — bounded to roughly 12 hours worst case,
not instant. A true sub-hour "sync now" would need either an
agent-turn-capable HTTP endpoint this sandbox doesn't have visibility
into, or simply asking a Claude Code Remote session to call
`mcp__Claude_Code_Remote__fire_trigger` directly on one of the two
Routine ids — available today, no code involved, just not
self-service from the web UI alone.

## What a sync run does, step by step

`provider_account_id` is resolved: it is our own stable internal
identifier, hardcoded as `DEFAULT_IBKR_PROVIDER_ACCOUNT_ID = "main"` in
`web/src/lib/broker/ibkr-mcp-normalize.ts` (no MCP response exposes
IBKR's real account id, and the architecture explicitly forbids inventing
one — this may be remapped later without touching historical rows).

1. **Executions.** Call `get_account_trades` with an appropriate `period`
   (`DAYS_7` for a daily catch-up sync, `DAYS_90` for a backfill).
   Response can be large (six-figure character counts for a wide period)
   — read it from the saved tool-result file in chunks if it exceeds the
   inline limit, not by narrowing the period until it fits. Run each
   trade through the compiled `normalizeIbkrTrade()`, then
   `insert ... on conflict (provider, dedup_key) do nothing` into
   `broker_executions` via `execute_sql`. Track `rows_inserted` vs.
   `rows_skipped` (duplicates) — a repeated sync over overlapping periods
   must be a no-op for trades already imported, never a duplicate row.
2. **Account / NLV snapshot.** Call `get_account_summary` and
   `get_account_balances`, run through `normalizeIbkrAccountSnapshot()`
   (uses `DEFAULT_IBKR_PROVIDER_ACCOUNT_ID` unless overridden), insert
   into `broker_account_snapshots`.
3. **Positions.** Call `get_account_positions`, run each row through
   `normalizeIbkrPosition()`, insert into `broker_positions_snapshots`.
   Note: `symbol` currently maps from `contract_description`, flagged
   unverified in code — confirm this is a bare ticker on the first live
   run and correct the mapping if it turns out to be a longer
   description.
4. **Campaign reconciliation.** For every distinct symbol touched by
   step 1's newly-inserted executions, query the current open campaign
   for that symbol (`status = 'open'`, most recent), sort that symbol's
   new fills ascending by `executed_at`, and run the compiled
   `reconcileCampaignFills()`. Apply the returned actions in order via
   `execute_sql`:
   - `open_campaign` → insert a `campaigns` row (`source = 'reconstructed'`),
     then resolve its `new-campaign-<n>` placeholder id to the real
     inserted uuid for any later action in the same batch that
     references it.
   - `attach_to_open` / `close_campaign` → insert a `campaign_executions`
     row linking the fill; `close_campaign` also updates the campaign's
     `status = 'closed'`, `ended_at`.
   - `flag_reversal` → still closes the existing campaign (insert
     `campaign_executions` + update status/ended_at), but the overshoot
     is **not** auto-opened into a new campaign — record it in this run's
     notes/`error_summary` for human review.

   Then run `findUnresolvedPriorPositions()` against this run's
   `broker_positions_snapshots` rows vs. the set of symbols with an open
   campaign after reconciliation. Any result here (a live position with
   no campaign to explain it) must **not** be silently dropped — record
   it in `error_summary` and downgrade this run's final status to
   `partial` even if nothing technically errored, since it represents
   real ambiguity a human still needs to resolve.
5. **Shadowlist auto-override.** If a `commitments` row with
   `status = 'LOCKED'` exists for today's America/New_York trade date
   (`getCurrentTradeDateET()` semantics — see
   `web/src/lib/trade-date.ts`), replicate
   `applyIbkrAutoOverride()` from `web/src/lib/data/shadowlist.ts`: for
   every `shadowlist_decisions` row on that commitment whose `ticker` now
   has a matching `campaigns` row for that `trade_date`, if it isn't
   already `actually_traded = true AND decision = 'Genommen'`, update it
   to that state and insert a `shadowlist_auto_overridden` audit event
   (`entity_type = 'shadowlist_decision'`, `actor = 'ibkr_sync'`,
   payload including `had_prior_manual_input`) via the same hash-chaining
   `appendAuditEvent()` logic in `web/src/lib/audit.ts` — read the
   previous event's `hash` first, canonicalize
   (deep-sorted-keys JSON) the same fields, `sha256`, insert. If no
   commitment is locked today, this step is a no-op, not a failure.
   (This same override also runs automatically whenever the Shadowlist
   page is loaded — this sync step exists so `actually_traded` is correct
   even if nobody opens the page that day.)
6. **Finalize `broker_sync_runs`.** One row per run, inserted at the very
   start of step 1 with `status = 'running'`. Update it once at the end
   with `completed_at` and the aggregate status:
   - `success` — every step completed and nothing was left unresolved.
   - `partial` — the run mostly completed but something needs human
     attention (an unresolved prior position, a flagged reversal, a step
     that partially failed but didn't abort the run).
   - `failed` — a required step errored and could not be recovered (e.g.
     the IBKR MCP connector reports "requires re-authorization" — this
     happens periodically since the OAuth token expires and only a human
     can re-authorize it via claude.ai connector settings; an unattended
     run cannot self-heal this).

   **A failure in one part must never silently mark the whole sync as
   successful.** If step 1 fails outright, do not proceed to steps 2-5 and
   report `status = 'failed'`. If step 1 succeeds but step 4 finds an
   unresolved prior position, steps 2/3/5 still run, but the final status
   is `partial`, never `success`.

## Known gaps in the normalized data (see code comments for detail)

`normalizeIbkrAccountSnapshot()` leaves several architecture-required
fields `null` because no verified IBKR MCP response supplies them:
`start_of_day_nlv`, `net_exposure_pct`, `realized_pnl_day`,
`unrealized_pnl_day`. `gross_exposure_pct` is derived
(`gross_position_value / net_liquidation_value`) and was cross-checked
against IBKR's own reported `leverage` field on real account data — that
one is trustworthy. The others are not fabricated; they stay null until a
verified source is found.

`normalizeIbkrPosition()`'s `symbol` field (from `contract_description`)
is unverified — the connector's OAuth token had expired before this could
be checked against a live `get_account_positions` call. Re-verify on the
first real sync.

## Operational caveat: IBKR OAuth token expiry

The `Interactive_Brokers_IBKR` MCP connector's token expires periodically
and can only be re-authorized interactively (via claude.ai connector
settings) — a scheduled/unattended agent turn cannot do this itself. When
this happens, a sync run correctly reports `status = 'failed'` per the
rules above rather than silently doing nothing; there is currently no
automated alert beyond that `broker_sync_runs` row. Completion
push/email notifications aren't available either — `create_trigger`
rejects the `notifications` param for session-bound Routines (self-bind
only supports it for `create_new_session_on_fire`). The user should
periodically check `broker_sync_runs` or the Shadowlist page's sync
status if daily data looks stale.

## Prerequisites

- This session (`persistent_session_id` the two Routines are bound to,
  see "Why this exists as a runbook" above) must stay reachable and keep
  holding the Supabase and Interactive_Brokers_IBKR connector
  authorizations — both Routines resume it on every firing rather than
  spawning a fresh session with its own connector grants.
- The `Interactive_Brokers_IBKR` MCP connector authorized and *not
  expired* at firing time (see caveat above).
- The `docyolo77/yolo-journal` repo checked out at a branch/commit that
  contains the current `web/src/lib/broker/ibkr-mcp-normalize.ts` and
  `web/src/lib/campaigns/reconcile.ts` — currently
  `claude/feasibility-check-l7dl1f`; re-point to `main` once that branch
  merges.
