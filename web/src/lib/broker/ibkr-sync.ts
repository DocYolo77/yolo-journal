// Orchestrates a full "Sync IBKR now" run: Trades + Activity Flex
// fetch -> dedupe-insert broker_executions -> account/positions
// snapshot -> campaign reconciliation -> shadowlist auto-override ->
// broker_sync_runs bookkeeping. Runs directly on the deployed Next.js
// server — no Claude/MCP/agent dependency (see docs/
// ibkr-agent-sync-runbook.md for the now-retired agent-based approach
// this replaces).
//
// Reuses existing pure logic rather than reimplementing it:
// lib/campaigns/reconcile.ts for fill grouping, lib/data/shadowlist.ts's
// getOrCreateShadowlistDecisions for the auto-override (already runs on
// every Shadowlist page load; called here too so it's correct
// immediately after a sync, not just on next page view).

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { appendAuditEvent } from "@/lib/audit";
import { getLatestCommitmentForDate } from "@/lib/data/commitments";
import { getOrCreateShadowlistDecisions } from "@/lib/data/shadowlist";
import { getCurrentTradeDateET, getTradeDateForInstant } from "@/lib/trade-date";
import { computeDedupKey } from "./execution-normalize";
import { fetchFlexStatementXml } from "./ibkr-flex-client";
import {
  normalizeFlexAccountSnapshot,
  parseOpenPositions,
  parseTradeConfirms,
  type NormalizedFlexAccountSnapshot,
  type NormalizedFlexPosition,
} from "./ibkr-flex-normalize";
import type { RawExecution } from "./provider";
import {
  findUnresolvedPriorPositions,
  reconcileCampaignFills,
  type CampaignDirection,
  type OpenCampaignState,
  type ReconcileFill,
} from "@/lib/campaigns/reconcile";
import { fetchFillsForCampaigns, sumClosedCampaignRealizedPnl } from "@/lib/campaigns/realized-pnl";

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

export type IbkrSyncSummary = {
  status: "success" | "partial" | "failed";
  startedAt: string;
  completedAt: string;
  executionsImported: number;
  executionsSkipped: number;
  netLiquidationValue: number | null;
  positionsCount: number;
  notes: string[];
  error: string | null;
};

type InsertedExecution = { id: string; symbol: string; side: "BUY" | "SELL"; quantity: number; executed_at: string };

async function startSyncRun(
  supabase: SupabaseAdminClient,
  syncType: "executions" | "account_snapshot"
): Promise<string> {
  const { data, error } = await supabase
    .from("broker_sync_runs")
    .insert({ provider: "IBKR", sync_type: syncType, status: "running" })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`broker_sync_runs (${syncType}) konnte nicht gestartet werden: ${error?.message ?? "unbekannt"}`);
  }
  return data.id as string;
}

async function finalizeSyncRun(
  supabase: SupabaseAdminClient,
  runId: string,
  params: {
    status: "success" | "partial" | "failed";
    rowsReceived?: number;
    rowsInserted?: number;
    rowsSkipped?: number;
    errorSummary?: string | null;
  }
): Promise<void> {
  await supabase
    .from("broker_sync_runs")
    .update({
      completed_at: new Date().toISOString(),
      status: params.status,
      rows_received: params.rowsReceived ?? null,
      rows_inserted: params.rowsInserted ?? null,
      rows_skipped: params.rowsSkipped ?? null,
      error_summary: params.errorSummary ?? null,
    })
    .eq("id", runId);
}

/**
 * Trades Flex fetch -> dedupe against existing broker_executions ->
 * insert only genuinely new fills. Existing dedup_key values are looked
 * up first (rather than relying purely on an upsert) so this also
 * returns precise rows_inserted/rows_skipped counts for
 * broker_sync_runs, and so newly-inserted rows come back with real ids
 * for campaign reconciliation.
 */
async function syncExecutions(
  supabase: SupabaseAdminClient
): Promise<{ inserted: InsertedExecution[]; received: number; skipped: number; error: string | null }> {
  const runId = await startSyncRun(supabase, "executions");
  try {
    const xml = await fetchFlexStatementXml("trades");
    const parsed: RawExecution[] = parseTradeConfirms(xml);
    const withDedup = parsed.map((raw) => ({ raw, dedupKey: computeDedupKey(raw) }));

    const dedupKeys = withDedup.map((w) => w.dedupKey);
    const { data: existing, error: existingError } =
      dedupKeys.length > 0
        ? await supabase.from("broker_executions").select("dedup_key").eq("provider", "IBKR").in("dedup_key", dedupKeys)
        : { data: [] as { dedup_key: string }[], error: null };
    if (existingError) {
      throw new Error(`Dedup-Prüfung fehlgeschlagen: ${existingError.message}`);
    }

    const existingKeys = new Set((existing ?? []).map((r) => r.dedup_key as string));
    const toInsert = withDedup.filter((w) => !existingKeys.has(w.dedupKey));

    let insertedRows: InsertedExecution[] = [];
    if (toInsert.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from("broker_executions")
        .insert(
          toInsert.map((w) => ({
            provider: "IBKR",
            provider_execution_id: w.raw.providerExecutionId,
            dedup_key: w.dedupKey,
            order_id: w.raw.orderId,
            symbol: w.raw.symbol,
            asset_class: w.raw.assetClass,
            side: w.raw.side,
            quantity: w.raw.quantity,
            price: w.raw.price,
            executed_at: w.raw.executedAt,
            commission: w.raw.commission,
            commission_currency: w.raw.commissionCurrency,
            open_close: w.raw.openClose,
            currency: w.raw.currency,
            raw_payload: w.raw.rawPayload,
          }))
        )
        .select("id, symbol, side, quantity, executed_at");
      if (insertError) {
        throw new Error(`Executions-Insert fehlgeschlagen: ${insertError.message}`);
      }
      insertedRows = (inserted ?? []) as InsertedExecution[];
    }

    await finalizeSyncRun(supabase, runId, {
      status: "success",
      rowsReceived: parsed.length,
      rowsInserted: insertedRows.length,
      rowsSkipped: parsed.length - insertedRows.length,
    });

    return { inserted: insertedRows, received: parsed.length, skipped: parsed.length - insertedRows.length, error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unbekannter Fehler beim Executions-Sync.";
    await finalizeSyncRun(supabase, runId, { status: "failed", errorSummary: message });
    return { inserted: [], received: 0, skipped: 0, error: message };
  }
}

/** Derives a symbol's currently-open campaign state from its linked executions (no cached running-quantity column exists). */
async function getOpenCampaignState(supabase: SupabaseAdminClient, symbol: string): Promise<OpenCampaignState | null> {
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, symbol, direction, status")
    .eq("symbol", symbol)
    .eq("status", "open")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!campaign) return null;

  const { data: links } = await supabase.from("campaign_executions").select("broker_execution_id").eq("campaign_id", campaign.id);
  const executionIds = (links ?? []).map((l) => l.broker_execution_id as string);

  if (executionIds.length === 0) {
    return { campaignId: campaign.id as string, symbol: campaign.symbol as string, direction: campaign.direction as CampaignDirection, netQuantity: 0 };
  }

  const { data: execs } = await supabase.from("broker_executions").select("side, quantity").in("id", executionIds);
  const netSigned = (execs ?? []).reduce(
    (sum, e) => sum + (e.side === "BUY" ? Number(e.quantity) : -Number(e.quantity)),
    0
  );

  return {
    campaignId: campaign.id as string,
    symbol: campaign.symbol as string,
    direction: campaign.direction as CampaignDirection,
    netQuantity: Math.abs(netSigned),
  };
}

/** Applies reconcileCampaignFills' actions to the DB for one symbol's newly-inserted fills. */
async function reconcileSymbolFills(
  supabase: SupabaseAdminClient,
  symbol: string,
  fills: InsertedExecution[]
): Promise<string[]> {
  const notes: string[] = [];
  const sorted = [...fills].sort((a, b) => a.executed_at.localeCompare(b.executed_at));
  const openState = await getOpenCampaignState(supabase, symbol);

  const reconcileFills: ReconcileFill[] = sorted.map((f) => ({
    executionId: f.id,
    symbol,
    side: f.side,
    quantity: Number(f.quantity),
    executedAt: f.executed_at,
  }));
  const actions = reconcileCampaignFills(reconcileFills, openState);

  const idMap = new Map<string, string>();
  const resolve = (campaignId: string) => idMap.get(campaignId) ?? campaignId;

  for (const action of actions) {
    if (action.type === "open_campaign") {
      const { data, error } = await supabase
        .from("campaigns")
        .insert({
          trade_date: getTradeDateForInstant(action.startedAt),
          symbol: action.symbol,
          direction: action.direction,
          started_at: action.startedAt,
          status: "open",
          source: action.source,
        })
        .select("id")
        .single();
      if (error || !data) throw new Error(`Campaign-Insert fehlgeschlagen (${symbol}): ${error?.message ?? "unbekannt"}`);
      idMap.set(action.campaignId, data.id as string);

      const { error: linkError } = await supabase
        .from("campaign_executions")
        .insert({ campaign_id: data.id, broker_execution_id: action.executionId });
      if (linkError) throw new Error(`Campaign-Execution-Link fehlgeschlagen (${symbol}): ${linkError.message}`);
      continue;
    }

    if (action.type === "attach_to_open") {
      const { error } = await supabase
        .from("campaign_executions")
        .insert({ campaign_id: resolve(action.campaignId), broker_execution_id: action.executionId });
      if (error) throw new Error(`Campaign-Execution-Link fehlgeschlagen (${symbol}): ${error.message}`);
      continue;
    }

    if (action.type === "close_campaign" || action.type === "flag_reversal") {
      const realId = resolve(action.campaignId);
      const { error: linkError } = await supabase
        .from("campaign_executions")
        .insert({ campaign_id: realId, broker_execution_id: action.executionId });
      if (linkError) throw new Error(`Campaign-Execution-Link fehlgeschlagen (${symbol}): ${linkError.message}`);

      const { error: updateError } = await supabase
        .from("campaigns")
        .update({ status: "closed", ended_at: action.endedAt })
        .eq("id", realId);
      if (updateError) throw new Error(`Campaign-Close fehlgeschlagen (${symbol}): ${updateError.message}`);

      if (action.type === "flag_reversal") {
        notes.push(
          `${symbol}: Fill überschießt die offene Position (Reversal, ${action.overshootQuantity} ${action.overshootDirection}) — nicht automatisch als neue Campaign angelegt, bitte manuell prüfen.`
        );
      }
    }
  }

  return notes;
}

async function reconcileNewExecutions(supabase: SupabaseAdminClient, newExecutions: InsertedExecution[]): Promise<string[]> {
  const bySymbol = new Map<string, InsertedExecution[]>();
  for (const e of newExecutions) {
    if (!bySymbol.has(e.symbol)) bySymbol.set(e.symbol, []);
    bySymbol.get(e.symbol)!.push(e);
  }

  const notes: string[] = [];
  for (const [symbol, fills] of bySymbol) {
    notes.push(...(await reconcileSymbolFills(supabase, symbol, fills)));
  }
  return notes;
}

async function checkUnresolvedPriorPositions(supabase: SupabaseAdminClient, positions: NormalizedFlexPosition[]): Promise<string[]> {
  const { data: openCampaigns } = await supabase.from("campaigns").select("symbol").eq("status", "open");
  const openSymbols = new Set((openCampaigns ?? []).map((c) => c.symbol as string));
  const unresolved = findUnresolvedPriorPositions(
    positions.map((p) => ({ symbol: p.symbol, quantity: p.quantity })),
    openSymbols
  );
  return unresolved.map(
    (u) => `${u.symbol}: Live-Position (${u.direction}, ${u.quantity}) ohne zugehörige offene Campaign — bitte manuell prüfen.`
  );
}

async function syncAccountAndPositions(
  supabase: SupabaseAdminClient
): Promise<{ snapshot: NormalizedFlexAccountSnapshot | null; positions: NormalizedFlexPosition[]; error: string | null }> {
  const runId = await startSyncRun(supabase, "account_snapshot");
  try {
    const xml = await fetchFlexStatementXml("activity");
    const capturedAt = new Date().toISOString();
    const snapshot = normalizeFlexAccountSnapshot(xml, { capturedAt });
    const positions = parseOpenPositions(xml, { capturedAt });

    if (snapshot) {
      const { error: snapshotError } = await supabase.from("broker_account_snapshots").insert(snapshot);
      if (snapshotError) throw new Error(`Account-Snapshot-Insert fehlgeschlagen: ${snapshotError.message}`);
    }
    if (positions.length > 0) {
      const { error: positionsError } = await supabase.from("broker_positions_snapshots").insert(positions);
      if (positionsError) throw new Error(`Positions-Insert fehlgeschlagen: ${positionsError.message}`);
    }

    const rowCount = positions.length + (snapshot ? 1 : 0);
    await finalizeSyncRun(supabase, runId, { status: "success", rowsReceived: rowCount, rowsInserted: rowCount });

    return { snapshot, positions, error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unbekannter Fehler beim Account/Positions-Sync.";
    await finalizeSyncRun(supabase, runId, { status: "failed", errorSummary: message });
    return { snapshot: null, positions: [], error: message };
  }
}

export async function runIbkrSync(): Promise<IbkrSyncSummary> {
  const startedAt = new Date().toISOString();
  const supabase = getSupabaseAdmin();
  const notes: string[] = [];
  let hadPartialIssue = false;

  const [executionsResult, accountResult] = await Promise.all([syncExecutions(supabase), syncAccountAndPositions(supabase)]);

  if (executionsResult.error && accountResult.error) {
    return {
      status: "failed",
      startedAt,
      completedAt: new Date().toISOString(),
      executionsImported: 0,
      executionsSkipped: 0,
      netLiquidationValue: null,
      positionsCount: 0,
      notes: [],
      error: `Executions: ${executionsResult.error} · Account: ${accountResult.error}`,
    };
  }

  if (executionsResult.error) {
    notes.push(`Executions-Sync fehlgeschlagen: ${executionsResult.error}`);
    hadPartialIssue = true;
  } else if (executionsResult.inserted.length > 0) {
    try {
      const reconcileNotes = await reconcileNewExecutions(supabase, executionsResult.inserted);
      notes.push(...reconcileNotes);
      if (reconcileNotes.length > 0) hadPartialIssue = true;
    } catch (e) {
      notes.push(e instanceof Error ? e.message : "Campaign-Reconciliation fehlgeschlagen.");
      hadPartialIssue = true;
    }
  }

  if (accountResult.error) {
    notes.push(`Account/Positions-Sync fehlgeschlagen: ${accountResult.error}`);
    hadPartialIssue = true;
  } else if (accountResult.positions.length > 0) {
    try {
      const priorPositionNotes = await checkUnresolvedPriorPositions(supabase, accountResult.positions);
      notes.push(...priorPositionNotes);
      if (priorPositionNotes.length > 0) hadPartialIssue = true;
    } catch (e) {
      notes.push(e instanceof Error ? e.message : "Prüfung auf ungeklärte Altpositionen fehlgeschlagen.");
      hadPartialIssue = true;
    }
  }

  // Shadowlist auto-override + MTD auto-computation for today's locked
  // commitment, if any — a no-op (not a failure) when nothing is locked
  // yet today.
  try {
    const tradeDate = getCurrentTradeDateET();
    const commitmentResult = await getLatestCommitmentForDate(tradeDate);
    if (commitmentResult.data && commitmentResult.data.status === "LOCKED") {
      const shadowlistResult = await getOrCreateShadowlistDecisions(commitmentResult.data);
      if (!shadowlistResult.data) {
        notes.push(`Shadowlist-Abgleich fehlgeschlagen: ${shadowlistResult.error}`);
        hadPartialIssue = true;
      }

      const mtdError = await syncMtdAutoFreshEntryPct(supabase, commitmentResult.data.id, tradeDate);
      if (mtdError) {
        notes.push(mtdError);
        hadPartialIssue = true;
      }
    }
  } catch (e) {
    notes.push(e instanceof Error ? e.message : "Shadowlist-Abgleich fehlgeschlagen.");
    hadPartialIssue = true;
  }

  const completedAt = new Date().toISOString();
  const status: "success" | "partial" = hadPartialIssue ? "partial" : "success";

  await appendAuditEvent({
    eventType: "ibkr_sync_completed",
    tradeDate: null,
    entityType: "broker_sync_run",
    entityId: null,
    actor: "ibkr_flex_sync",
    payload: { status, executionsImported: executionsResult.inserted.length, notes },
  });

  return {
    status,
    startedAt,
    completedAt,
    executionsImported: executionsResult.inserted.length,
    executionsSkipped: executionsResult.skipped,
    netLiquidationValue: accountResult.snapshot?.net_liquidation_value ?? null,
    positionsCount: accountResult.positions.length,
    notes,
    error: null,
  };
}

/**
 * Computes "MTD % — nur neue Entries" (commitment section 3) from real
 * closed campaigns opened this calendar month, and writes it onto
 * today's LOCKED commitment. mtd_auto_fresh_entry_realized_pct has
 * existed in the schema/form since early in this build but never had a
 * writer anywhere in the codebase — this is that writer, mirroring the
 * shadowlist auto-override pattern above (runs on every sync, so the
 * locked commitment reflects the latest fills immediately).
 *
 * Baseline is the most recent broker_account_snapshots NLV strictly
 * before the 1st of the month; without a baseline this is a no-op (not
 * an error) — nothing to divide by yet, not worth a guess.
 */
async function syncMtdAutoFreshEntryPct(
  supabase: SupabaseAdminClient,
  commitmentId: string,
  tradeDate: string
): Promise<string | null> {
  const monthStart = `${tradeDate.slice(0, 7)}-01`;

  const { data: campaigns, error: campaignsError } = await supabase
    .from("campaigns")
    .select("id, status")
    .gte("trade_date", monthStart)
    .lte("trade_date", tradeDate);

  if (campaignsError) {
    return `MTD-Berechnung fehlgeschlagen: ${campaignsError.message}`;
  }

  const monthCampaigns = (campaigns ?? []) as { id: string; status: string }[];
  const fillsByCampaignId = await fetchFillsForCampaigns(
    supabase,
    monthCampaigns.map((c) => ({ id: c.id }))
  );
  const realizedPnl = sumClosedCampaignRealizedPnl(monthCampaigns, fillsByCampaignId);

  const { data: baselineRow, error: baselineError } = await supabase
    .from("broker_account_snapshots")
    .select("net_liquidation_value")
    .lt("trading_date", monthStart)
    .order("trading_date", { ascending: false })
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (baselineError) {
    return `MTD-Berechnung fehlgeschlagen: ${baselineError.message}`;
  }

  const baselineNlv = (baselineRow?.net_liquidation_value as number | null) ?? null;
  if (!baselineNlv) {
    // No snapshot before this month yet (e.g. sync only started this
    // month) — genuinely not computable, not a failure.
    return null;
  }

  const pct = Math.round((realizedPnl / baselineNlv) * 100 * 100) / 100;

  const { error: updateError } = await supabase
    .from("commitments")
    .update({ mtd_auto_fresh_entry_realized_pct: pct })
    .eq("id", commitmentId);

  if (updateError) {
    return `MTD-Wert konnte nicht gespeichert werden: ${updateError.message}`;
  }

  return null;
}
