import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getDailyReviewContext } from "./daily-review";
import { getPortfolioSnapshotForDate } from "./portfolio";
import {
  computeOrbLevelsFromIntraday,
  getDailyChartSeries,
  getIntradayChartSeries,
  getIntradayWarmupBars,
} from "@/lib/market-data/chart-data";
import { appendAuditEvent } from "@/lib/audit";
import { computeCampaignRealizedPnl, fetchFillsForCampaigns } from "@/lib/campaigns/realized-pnl";
import type {
  ChartMarker,
  DailyReportCampaign,
  DailyReportSnapshotData,
  DailyReportSnapshotRow,
  ReportMarketData,
  ShadowlistDecisionRow,
  TickerChartData,
} from "@/lib/supabase/types";

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

const MARKER_LABELS: Record<ChartMarker["event_type"], string> = {
  ENTRY: "Entry",
  ADD: "Add",
  PARTIAL_EXIT: "Partial",
  EXIT: "Exit",
};

/**
 * Classifies a chronological execution list into Entry/Add/Partial-
 * Exit/Exit events by tracking running position size. This is a
 * heuristic stand-in — real IBKR fills carry no such classification of
 * their own — that keeps the marker architecture (ChartMarker.event_type)
 * ready for a future IBKR Flex Web Service sync to populate more
 * precisely (e.g. via order/campaign linkage) without changing the chart
 * rendering side at all.
 */
function classifyExecutions(
  executions: { side: "BUY" | "SELL"; price: number; executed_at: string; quantity: number }[]
): ChartMarker[] {
  let position = 0;
  return executions.map((e) => {
    const signedQty = e.side === "BUY" ? e.quantity : -e.quantity;
    const wasFlat = position === 0;
    const nextPosition = position + signedQty;

    let eventType: ChartMarker["event_type"];
    if (e.side === "BUY") {
      eventType = wasFlat ? "ENTRY" : "ADD";
    } else {
      eventType = nextPosition <= 0 ? "EXIT" : "PARTIAL_EXIT";
    }

    position = nextPosition;

    return {
      timestamp: e.executed_at,
      side: e.side,
      price: e.price,
      label: MARKER_LABELS[eventType],
      event_type: eventType,
    };
  });
}

/**
 * Entry/Add/Partial-Exit/Exit markers from real broker data — campaigns
 * -> campaign_executions -> broker_executions for this trade_date/ticker.
 * Empty (not fabricated) whenever no broker data has been synced yet,
 * which is the honest state of this app today (no successful IBKR sync
 * has run).
 */
async function getMarkersForTicker(
  supabase: SupabaseAdminClient,
  tradeDate: string,
  ticker: string
): Promise<ChartMarker[]> {
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id")
    .eq("trade_date", tradeDate)
    .eq("symbol", ticker);

  const campaignIds = (campaigns ?? []).map((c) => c.id as string);
  if (campaignIds.length === 0) return [];

  const { data: campaignExecutions } = await supabase
    .from("campaign_executions")
    .select("broker_execution_id")
    .in("campaign_id", campaignIds);

  const executionIds = (campaignExecutions ?? []).map((ce) => ce.broker_execution_id as string);
  if (executionIds.length === 0) return [];

  const { data: executions } = await supabase
    .from("broker_executions")
    .select("side, price, executed_at, quantity")
    .in("id", executionIds)
    .order("executed_at", { ascending: true });

  const validExecutions = (executions ?? [])
    .filter((e) => e.price !== null)
    .map((e) => ({
      side: e.side as "BUY" | "SELL",
      price: e.price as number,
      executed_at: e.executed_at as string,
      quantity: Number(e.quantity),
    }));

  return classifyExecutions(validExecutions);
}

/**
 * Daily + intraday (with warmup) + entry/exit markers + ORB levels for
 * each ticker — the reusable per-ticker chart bundle shared by the
 * finalized report (assembleMarketData below) and the live, still-
 * editable Daily Review page (getTickerChartDataForReview), so both show
 * the exact same chart data/markers for a given ticker/date.
 */
async function assembleTickerChartData(
  supabase: SupabaseAdminClient,
  tradeDate: string,
  tickers: string[]
): Promise<TickerChartData[]> {
  return Promise.all(
    tickers.map(async (ticker) => {
      const [daily, intraday, intradayWarmup, markers] = await Promise.all([
        getDailyChartSeries(ticker, tradeDate),
        getIntradayChartSeries(ticker, tradeDate),
        getIntradayWarmupBars(ticker, tradeDate),
        getMarkersForTicker(supabase, tradeDate, ticker),
      ]);
      return {
        ticker,
        daily,
        intraday,
        intraday_warmup: intradayWarmup,
        markers,
        orb_levels: computeOrbLevelsFromIntraday(intraday),
      };
    })
  );
}

/**
 * Daily + intraday charts with entry/exit markers for a ticker set, for
 * the live (not-yet-finalized) Daily Review page's Ticker Review section
 * — best-effort, never blocks the page if Massive is unreachable.
 */
export async function getTickerChartDataForReview(tradeDate: string, tickers: string[]): Promise<TickerChartData[]> {
  if (tickers.length === 0) return [];
  try {
    const supabase = getSupabaseAdmin();
    return await assembleTickerChartData(supabase, tradeDate, tickers);
  } catch (e) {
    console.error("getTickerChartDataForReview failed", e);
    return [];
  }
}

async function assembleMarketData(
  supabase: SupabaseAdminClient,
  tradeDate: string,
  tickers: string[]
): Promise<ReportMarketData> {
  try {
    const indexContext = await Promise.all(
      (["QQQ", "SPY"] as const).map(async (ticker) => ({
        ticker,
        daily: await getDailyChartSeries(ticker, tradeDate),
      }))
    );

    const tickerData = await assembleTickerChartData(supabase, tradeDate, tickers);

    return { index_context: indexContext, tickers: tickerData, fetch_error: null };
  } catch (e) {
    console.error("assembleMarketData failed", e);
    const message = e instanceof Error ? e.message : "Marktdaten konnten nicht geladen werden.";
    // Never blocks finalization — a Daily Review is still worth
    // finalizing even if Massive is unreachable; the report just shows
    // this error instead of charts.
    return { index_context: [], tickers: [], fetch_error: message };
  }
}

/**
 * Today's economic campaigns with full entry/add/exit fill data (price,
 * time, quantity) — the tabular counterpart to getMarkersForTicker's
 * chart dots. Real IBKR fills only (campaigns -> campaign_executions ->
 * broker_executions); empty when nothing has synced for this day yet.
 */
async function assembleCampaignData(
  supabase: SupabaseAdminClient,
  tradeDate: string
): Promise<DailyReportCampaign[]> {
  const { data: campaignRows } = await supabase
    .from("campaigns")
    .select("id, symbol, direction, status, started_at, ended_at")
    .eq("trade_date", tradeDate)
    .order("started_at", { ascending: true });

  const campaigns = campaignRows ?? [];
  if (campaigns.length === 0) return [];

  const fillsByCampaignId = await fetchFillsForCampaigns(
    supabase,
    campaigns.map((c) => ({ id: c.id as string }))
  );

  return campaigns.map((c) => {
    const fills = fillsByCampaignId.get(c.id as string) ?? [];
    return {
      id: c.id as string,
      symbol: c.symbol as string,
      direction: (c.direction as string | null) ?? null,
      status: c.status as string,
      started_at: (c.started_at as string | null) ?? null,
      ended_at: (c.ended_at as string | null) ?? null,
      realized_pnl: c.status === "closed" ? computeCampaignRealizedPnl(fills) : null,
      fills: fills.map((f) => ({
        side: f.side,
        price: f.price,
        quantity: f.quantity,
        executed_at: f.executed_at,
      })),
    };
  });
}

/**
 * Today's economic campaigns (entry price/time/quantity, and exit
 * price/time if the position was closed same day) for the live, not-yet-
 * finalized Daily Review page — same data assembleCampaignData produces
 * for the finalized report, just callable before finalization exists.
 */
export async function getCampaignsForReview(tradeDate: string): Promise<DailyReportCampaign[]> {
  try {
    const supabase = getSupabaseAdmin();
    return await assembleCampaignData(supabase, tradeDate);
  } catch (e) {
    console.error("getCampaignsForReview failed", e);
    return [];
  }
}

/**
 * Finalizes a Daily Review into an immutable report snapshot.
 * unique(trade_date) on daily_report_snapshots backs the "never
 * silently overwritten" guarantee at the DB level; this checks first
 * too, so the (potentially slow, Massive-calling) assembly work is
 * skipped entirely when a snapshot already exists.
 */
export async function finalizeDailyReview(
  tradeDate: string
): Promise<{ data: DailyReportSnapshotRow; error: null } | { data: null; error: string }> {
  try {
    const supabase = getSupabaseAdmin();

    const { data: existingSnapshot, error: existingError } = await supabase
      .from("daily_report_snapshots")
      .select("id")
      .eq("trade_date", tradeDate)
      .maybeSingle();

    if (existingError) {
      console.error("finalizeDailyReview: existing-snapshot lookup failed", existingError);
      return { data: null, error: "Report-Snapshot konnte nicht geprüft werden." };
    }
    if (existingSnapshot) {
      return { data: null, error: "Für dieses Datum existiert bereits ein finalisierter Report." };
    }

    const contextResult = await getDailyReviewContext(tradeDate);
    if (!contextResult.data) {
      return { data: null, error: contextResult.error };
    }
    const { review, commitment } = contextResult.data;
    if (!review) {
      return { data: null, error: "Kein Daily Review für dieses Datum vorhanden — zuerst speichern." };
    }
    if (!review.guardrails_reviewed) {
      return {
        data: null,
        error: "Guardrails müssen zuerst als geprüft markiert und gespeichert werden, bevor der Review abgeschlossen werden kann.",
      };
    }

    let shadowlist: ShadowlistDecisionRow[] = [];
    if (commitment) {
      const { data: shadowlistRows, error: shadowlistError } = await supabase
        .from("shadowlist_decisions")
        .select("*")
        .eq("commitment_id", commitment.id);

      if (shadowlistError) {
        console.error("finalizeDailyReview: shadowlist lookup failed", shadowlistError);
        return { data: null, error: "Shadowlist konnte nicht geladen werden." };
      }
      shadowlist = shadowlistRows ?? [];
    }

    const brokerSelect = "net_liquidation_value, cash, buying_power, gross_exposure_pct, captured_at, trading_date";

    const { data: exactBrokerRow, error: exactBrokerError } = await supabase
      .from("broker_account_snapshots")
      .select(brokerSelect)
      .eq("trading_date", tradeDate)
      .order("captured_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (exactBrokerError) {
      // Best-effort only — broker sync may simply never have run yet.
      console.error("finalizeDailyReview: broker snapshot lookup failed (continuing)", exactBrokerError);
    }

    let brokerRow = exactBrokerRow ?? null;

    if (!brokerRow && !exactBrokerError) {
      // IBKR's Activity Flex Query ("LastBusinessDay") can still be
      // reporting yesterday's statement at sync time even though today's
      // campaigns (execution-timestamp-derived) already exist — fall back
      // to the nearest snapshot on or before tradeDate rather than
      // silently showing "keine Broker-Daten" (same fix as
      // getDailyPnlSnapshotForDate in lib/data/portfolio.ts).
      const { data: fallbackBrokerRow, error: fallbackBrokerError } = await supabase
        .from("broker_account_snapshots")
        .select(brokerSelect)
        .lte("trading_date", tradeDate)
        .order("trading_date", { ascending: false })
        .order("captured_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fallbackBrokerError) {
        console.error("finalizeDailyReview: broker snapshot fallback lookup failed (continuing)", fallbackBrokerError);
      } else {
        brokerRow = fallbackBrokerRow ?? null;
      }
    }

    const tickers = Array.from(new Set(review.ticker_reviews.map((t) => t.ticker)));
    const marketData = await assembleMarketData(supabase, tradeDate, tickers);

    let campaigns: DailyReportCampaign[] = [];
    try {
      campaigns = await assembleCampaignData(supabase, tradeDate);
    } catch (e) {
      console.error("finalizeDailyReview: campaign data assembly failed (continuing)", e);
    }

    // Best-effort — same as the broker account snapshot above, never
    // blocks finalization if IBKR positions haven't synced. A non-empty
    // manual_portfolio_positions override always wins over the IBKR sync
    // — the user only fills that in when the sync is known to be wrong.
    const hasManualOverride = review.manual_portfolio_positions.length > 0;
    const portfolioSnapshot = hasManualOverride ? null : await getPortfolioSnapshotForDate(tradeDate);

    const snapshot: DailyReportSnapshotData = {
      report_schema_version: 1,
      trade_date: tradeDate,
      created_at: new Date().toISOString(),
      review,
      commitment,
      shadowlist,
      broker_account_snapshot: brokerRow ?? null,
      market_data: marketData,
      campaigns,
      portfolio_snapshot: hasManualOverride
        ? { captured_at: null, positions: review.manual_portfolio_positions, source: "manual" }
        : { captured_at: portfolioSnapshot!.capturedAt, positions: portfolioSnapshot!.positions, source: "ibkr_sync" },
    };

    const { data: inserted, error: insertError } = await supabase
      .from("daily_report_snapshots")
      .insert({ trade_date: tradeDate, report_schema_version: 1, snapshot })
      .select("*")
      .single();

    if (insertError || !inserted) {
      console.error("finalizeDailyReview: insert failed", insertError);
      return {
        data: null,
        error: `Report-Snapshot konnte nicht gespeichert werden.${insertError ? ` (${insertError.message})` : ""}`,
      };
    }

    // Best-effort status sync — the snapshot row is the actual source of
    // truth for "is this finalized" regardless of whether this succeeds.
    const { error: statusError } = await supabase
      .from("daily_reviews")
      .update({ status: "COMPLETED" })
      .eq("id", review.id);
    if (statusError) {
      console.error("finalizeDailyReview: daily_reviews status update failed (snapshot already saved)", statusError);
    }

    await appendAuditEvent({
      eventType: "daily_review_finalized",
      tradeDate,
      entityType: "daily_report_snapshot",
      entityId: inserted.id,
      payload: { review_id: review.id },
    });

    return { data: inserted as DailyReportSnapshotRow, error: null };
  } catch (e) {
    console.error("finalizeDailyReview failed", e);
    const message = e instanceof Error ? e.message : "Report konnte nicht finalisiert werden.";
    return { data: null, error: message };
  }
}

export async function getReportSnapshot(
  tradeDate: string
): Promise<{ data: DailyReportSnapshotRow | null; error: null } | { data: null; error: string }> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("daily_report_snapshots")
      .select("*")
      .eq("trade_date", tradeDate)
      .maybeSingle();

    if (error) {
      console.error("getReportSnapshot failed", error);
      return { data: null, error: "Report konnte nicht geladen werden." };
    }

    return { data: (data as DailyReportSnapshotRow | null) ?? null, error: null };
  } catch (e) {
    console.error("getReportSnapshot failed", e);
    return { data: null, error: "Report konnte nicht geladen werden." };
  }
}

/** Used by saveDailyReviewAction to refuse edits once finalized. */
export async function hasReportSnapshot(tradeDate: string): Promise<boolean> {
  const result = await getReportSnapshot(tradeDate);
  return result.data !== null;
}
