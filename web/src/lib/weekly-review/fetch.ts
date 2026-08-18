// Raw data fetch for one Monday-Friday trading week — all I/O for the
// Weekly Review aggregation lives here, kept separate from
// compute.ts's pure aggregation math so that math is unit-testable
// without a live Supabase connection (same split as the Daily Report
// system's report-snapshot.ts vs. the pure chart/series functions).

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getDailyChartSeries } from "@/lib/market-data/chart-data";
import { fetchFillsForCampaigns, type CampaignFill } from "@/lib/campaigns/realized-pnl";
import type { CampaignRow, ChartSeriesPoint, DailyReviewRow, ShadowlistDecisionRow } from "@/lib/supabase/types";

export type { CampaignFill };

export type AccountSnapshotPoint = {
  trading_date: string;
  captured_at: string;
  net_liquidation_value: number | null;
};

export type PositionsUnrealizedTotal = {
  captured_at: string;
  total_unrealized_pnl: number | null;
};

export type WeeklyRawData = {
  weekStart: string;
  weekEnd: string;
  dailyReviews: DailyReviewRow[];
  /** Latest revision per trade_date, LOCKED only — a DRAFT commitment is never a real plan (same rule as everywhere else in this app). */
  lockedCommitments: {
    trade_date: string;
    committed_risk_pct: number | null;
    intraday_risk_pct: number | null;
    market_environment_note: string | null;
    mtd_pause_threshold_reached: boolean;
    mtd_manual_pct: number | null;
    loss_state_reduced_size_mode: boolean;
    loss_state_review_trigger_reached: boolean;
  }[];
  shadowlistDecisions: ShadowlistDecisionRow[];
  campaigns: CampaignRow[];
  /** campaign_id -> its linked fills, ascending by executed_at. */
  fillsByCampaignId: Map<string, CampaignFill[]>;
  accountSnapshotsInWeek: AccountSnapshotPoint[];
  previousAccountSnapshot: AccountSnapshotPoint | null;
  positionsUnrealizedInWeek: PositionsUnrealizedTotal | null;
  positionsUnrealizedBeforeWeek: PositionsUnrealizedTotal | null;
  indexContext: { ticker: "QQQ" | "SPY"; daily: ChartSeriesPoint[] }[];
};

export async function fetchWeeklyRawData(weekStart: string, weekEnd: string): Promise<WeeklyRawData> {
  const supabase = getSupabaseAdmin();

  const [
    { data: dailyReviews },
    { data: rawCommitments },
    { data: shadowlistDecisions },
    { data: campaigns },
    { data: accountSnapshotRows },
    { data: previousAccountRows },
    { data: positionsInWeekRows },
    { data: positionsBeforeWeekRows },
    indexContext,
  ] = await Promise.all([
    supabase.from("daily_reviews").select("*").gte("trade_date", weekStart).lte("trade_date", weekEnd).order("trade_date"),
    supabase
      .from("commitments")
      .select(
        "trade_date, revision, status, committed_risk_pct, intraday_risk_pct, market_state_note, mtd_pause_threshold_reached, mtd_manual_pct, loss_state_reduced_size_mode, loss_state_review_trigger_reached"
      )
      .gte("trade_date", weekStart)
      .lte("trade_date", weekEnd)
      .order("trade_date")
      .order("revision", { ascending: false }),
    supabase.from("shadowlist_decisions").select("*").gte("trade_date", weekStart).lte("trade_date", weekEnd),
    supabase.from("campaigns").select("*").gte("trade_date", weekStart).lte("trade_date", weekEnd).order("started_at"),
    supabase
      .from("broker_account_snapshots")
      .select("trading_date, captured_at, net_liquidation_value")
      .gte("trading_date", weekStart)
      .lte("trading_date", weekEnd)
      .order("trading_date")
      .order("captured_at", { ascending: false }),
    supabase
      .from("broker_account_snapshots")
      .select("trading_date, captured_at, net_liquidation_value")
      .lt("trading_date", weekStart)
      .order("trading_date", { ascending: false })
      .order("captured_at", { ascending: false })
      .limit(1),
    supabase
      .from("broker_positions_snapshots")
      .select("captured_at, unrealized_pnl")
      .gte("trading_date", weekStart)
      .lte("trading_date", weekEnd)
      .order("captured_at", { ascending: false })
      .limit(50),
    supabase
      .from("broker_positions_snapshots")
      .select("captured_at, unrealized_pnl")
      .lt("trading_date", weekStart)
      .order("captured_at", { ascending: false })
      .limit(50),
    Promise.all(
      (["QQQ", "SPY"] as const).map(async (ticker) => ({ ticker, daily: await getDailyChartSeries(ticker, weekEnd) }))
    ),
  ]);

  // One row per distinct trade_date, latest revision.
  const commitmentByDate = new Map<string, NonNullable<typeof rawCommitments>[number]>();
  for (const row of rawCommitments ?? []) {
    if (!commitmentByDate.has(row.trade_date)) commitmentByDate.set(row.trade_date, row);
  }
  const lockedCommitments = Array.from(commitmentByDate.values())
    .filter((c) => c.status === "LOCKED")
    .map((c) => ({
      trade_date: c.trade_date as string,
      committed_risk_pct: (c.committed_risk_pct as number | null) ?? null,
      intraday_risk_pct: (c.intraday_risk_pct as number | null) ?? null,
      market_environment_note: (c.market_state_note as string | null) ?? null,
      mtd_pause_threshold_reached: Boolean(c.mtd_pause_threshold_reached),
      mtd_manual_pct: (c.mtd_manual_pct as number | null) ?? null,
      loss_state_reduced_size_mode: Boolean(c.loss_state_reduced_size_mode),
      loss_state_review_trigger_reached: Boolean(c.loss_state_review_trigger_reached),
    }));

  // One row per distinct trading_date within the week, latest captured_at.
  const accountByDate = new Map<string, AccountSnapshotPoint>();
  for (const row of accountSnapshotRows ?? []) {
    if (!accountByDate.has(row.trading_date as string)) {
      accountByDate.set(row.trading_date as string, {
        trading_date: row.trading_date as string,
        captured_at: row.captured_at as string,
        net_liquidation_value: (row.net_liquidation_value as number | null) ?? null,
      });
    }
  }
  const accountSnapshotsInWeek = Array.from(accountByDate.values()).sort((a, b) =>
    a.trading_date < b.trading_date ? -1 : 1
  );

  const previousRow = previousAccountRows?.[0] ?? null;
  const previousAccountSnapshot: AccountSnapshotPoint | null = previousRow
    ? {
        trading_date: previousRow.trading_date as string,
        captured_at: previousRow.captured_at as string,
        net_liquidation_value: (previousRow.net_liquidation_value as number | null) ?? null,
      }
    : null;

  const sumUnrealized = (rows: { captured_at: string; unrealized_pnl: number | null }[] | null): PositionsUnrealizedTotal | null => {
    if (!rows || rows.length === 0) return null;
    const latestCapturedAt = rows.reduce((max, r) => (r.captured_at > max ? r.captured_at : max), rows[0].captured_at);
    const sameCapture = rows.filter((r) => r.captured_at === latestCapturedAt);
    const total = sameCapture.reduce((sum, r) => sum + (r.unrealized_pnl ?? 0), 0);
    return { captured_at: latestCapturedAt, total_unrealized_pnl: total };
  };

  const campaignRows = (campaigns ?? []) as CampaignRow[];
  const fillsByCampaignId = await fetchFillsForCampaigns(supabase, campaignRows);

  return {
    weekStart,
    weekEnd,
    dailyReviews: (dailyReviews ?? []) as DailyReviewRow[],
    lockedCommitments,
    shadowlistDecisions: (shadowlistDecisions ?? []) as ShadowlistDecisionRow[],
    campaigns: campaignRows,
    fillsByCampaignId,
    accountSnapshotsInWeek,
    previousAccountSnapshot,
    positionsUnrealizedInWeek: sumUnrealized(positionsInWeekRows as { captured_at: string; unrealized_pnl: number | null }[] | null),
    positionsUnrealizedBeforeWeek: sumUnrealized(
      positionsBeforeWeekRows as { captured_at: string; unrealized_pnl: number | null }[] | null
    ),
    indexContext,
  };
}

/** daily_report_snapshots.id values for this week — referenced (not re-derived) by the FINAL weekly snapshot per §21. */
export async function getSourceDailyReportIds(weekStart: string, weekEnd: string): Promise<string[]> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("daily_report_snapshots")
    .select("id")
    .gte("trade_date", weekStart)
    .lte("trade_date", weekEnd);
  return (data ?? []).map((r) => r.id as string);
}

