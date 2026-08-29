import { getSupabaseAdmin } from "@/lib/supabase/server";

export type PortfolioPosition = {
  symbol: string;
  quantity: number;
  average_price: number | null;
  market_price: number | null;
  unrealized_pnl: number | null;
  currency: string | null;
};

export type LatestPortfolio = {
  positions: PortfolioPosition[];
  capturedAt: string | null;
};

/**
 * The most recent broker_positions_snapshots capture — "aktuelles
 * Portfolio" always means the latest IBKR sync, independent of which
 * trade_date's Daily Review is being viewed (positions aren't scoped
 * per review day, unlike executions/campaigns).
 */
export async function getLatestPortfolioPositions(): Promise<
  { data: LatestPortfolio; error: null } | { data: null; error: string }
> {
  try {
    const supabase = getSupabaseAdmin();

    const { data: latest, error: latestError } = await supabase
      .from("broker_positions_snapshots")
      .select("captured_at")
      .order("captured_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) {
      console.error("getLatestPortfolioPositions: latest lookup failed", latestError);
      return { data: null, error: "Portfolio konnte nicht geladen werden." };
    }
    if (!latest) {
      return { data: { positions: [], capturedAt: null }, error: null };
    }

    const { data: rows, error: rowsError } = await supabase
      .from("broker_positions_snapshots")
      .select("symbol, quantity, average_price, market_price, unrealized_pnl, currency")
      .eq("captured_at", latest.captured_at)
      .order("symbol", { ascending: true });

    if (rowsError) {
      console.error("getLatestPortfolioPositions: rows lookup failed", rowsError);
      return { data: null, error: "Portfolio konnte nicht geladen werden." };
    }

    return {
      data: { positions: (rows ?? []) as PortfolioPosition[], capturedAt: latest.captured_at as string },
      error: null,
    };
  } catch (e) {
    console.error("getLatestPortfolioPositions failed", e);
    return { data: null, error: "Portfolio konnte nicht geladen werden." };
  }
}

/**
 * Portfolio positions as of `tradeDate` — used by the finalized Daily
 * Report so a report always shows the portfolio as it stood on its own
 * trade_date, not whatever the globally latest sync happens to be by
 * the time someone views an older report. Same exact-then-fallback
 * pattern as getDailyPnlSnapshotForDate, for the same IBKR EOD-batch-
 * timing reason. Covers both same-day campaign positions and older
 * carried positions — broker_positions_snapshots isn't scoped to a
 * single day's campaigns.
 */
export async function getPortfolioSnapshotForDate(tradeDate: string): Promise<LatestPortfolio> {
  try {
    const supabase = getSupabaseAdmin();

    const { data: exactLatest, error: exactError } = await supabase
      .from("broker_positions_snapshots")
      .select("captured_at")
      .eq("trading_date", tradeDate)
      .order("captured_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (exactError) {
      console.error("getPortfolioSnapshotForDate: exact lookup failed", exactError);
      return { positions: [], capturedAt: null };
    }

    let latest = exactLatest;
    if (!latest) {
      const { data: fallbackLatest, error: fallbackError } = await supabase
        .from("broker_positions_snapshots")
        .select("captured_at")
        .lte("trading_date", tradeDate)
        .order("trading_date", { ascending: false })
        .order("captured_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (fallbackError) {
        console.error("getPortfolioSnapshotForDate: fallback lookup failed", fallbackError);
        return { positions: [], capturedAt: null };
      }
      latest = fallbackLatest;
    }

    if (!latest) return { positions: [], capturedAt: null };

    const { data: rows, error: rowsError } = await supabase
      .from("broker_positions_snapshots")
      .select("symbol, quantity, average_price, market_price, unrealized_pnl, currency")
      .eq("captured_at", latest.captured_at)
      .order("symbol", { ascending: true });

    if (rowsError) {
      console.error("getPortfolioSnapshotForDate: rows lookup failed", rowsError);
      return { positions: [], capturedAt: null };
    }

    return {
      positions: (rows ?? []) as PortfolioPosition[],
      capturedAt: latest.captured_at as string,
    };
  } catch (e) {
    console.error("getPortfolioSnapshotForDate failed", e);
    return { positions: [], capturedAt: null };
  }
}

export type DailyPnlSnapshot = {
  nlv: number | null;
  /**
   * The snapshot's real trading_date — may differ from the requested
   * tradeDate (see below) when a fallback was used. Always show this to
   * the user when it's not the requested date, rather than implying the
   * number is for today.
   */
  nlvTradingDate: string | null;
  previousNlv: number | null;
  previousTradingDate: string | null;
  dailyPnlDollar: number | null;
  dailyPnlPct: number | null;
  capturedAt: string | null;
  baseCurrency: string | null;
  /** "ibkr_flex_sync" | "manual_json_import" | null — which ingestion path produced this snapshot, per §8 of the IBKR JSON import spec. */
  source: string | null;
};

/**
 * NLV for `tradeDate` plus day-over-day P&L against the nearest EARLIER
 * trading_date's snapshot — both read from broker_account_snapshots,
 * which is append-only/historized specifically so this kind of NLV move
 * stays reconstructable (see 20260813180619_..._broker_schema.sql).
 *
 * Prefers an exact match on tradeDate, but falls back to the nearest
 * snapshot on or before it rather than silently reporting nothing:
 * IBKR's Activity Flex Query ("LastBusinessDay") reports whichever
 * trading day IBKR's own EOD batch has actually finished processing at
 * sync time — syncing right around/after the close can still land on
 * yesterday's statement if today's isn't ready yet, even though
 * campaigns (derived from real execution timestamps, always current)
 * already show today's trades. `nlvTradingDate` always carries the real
 * date used so the UI can say "vom <date>" instead of implying it's
 * today's number.
 */
export async function getDailyPnlSnapshotForDate(
  tradeDate: string
): Promise<{ data: DailyPnlSnapshot; error: null } | { data: null; error: string }> {
  try {
    const supabase = getSupabaseAdmin();

    const { data: exactRows, error: exactError } = await supabase
      .from("broker_account_snapshots")
      .select("net_liquidation_value, captured_at, base_currency, trading_date, source")
      .eq("trading_date", tradeDate)
      .order("captured_at", { ascending: false })
      .limit(1);

    if (exactError) {
      console.error("getDailyPnlSnapshotForDate: exact lookup failed", exactError);
      return { data: null, error: "NLV/P&L konnten nicht geladen werden." };
    }

    let current = exactRows?.[0] ?? null;

    if (!current) {
      const { data: fallbackRows, error: fallbackError } = await supabase
        .from("broker_account_snapshots")
        .select("net_liquidation_value, captured_at, base_currency, trading_date, source")
        .lte("trading_date", tradeDate)
        .order("trading_date", { ascending: false })
        .order("captured_at", { ascending: false })
        .limit(1);

      if (fallbackError) {
        console.error("getDailyPnlSnapshotForDate: fallback lookup failed", fallbackError);
        return { data: null, error: "NLV/P&L konnten nicht geladen werden." };
      }
      current = fallbackRows?.[0] ?? null;
    }

    const currentTradingDate = (current?.trading_date as string | null) ?? null;

    const { data: previousRows, error: previousError } = currentTradingDate
      ? await supabase
          .from("broker_account_snapshots")
          .select("net_liquidation_value, trading_date")
          .lt("trading_date", currentTradingDate)
          .order("trading_date", { ascending: false })
          .order("captured_at", { ascending: false })
          .limit(1)
      : { data: null, error: null };

    if (previousError) {
      console.error("getDailyPnlSnapshotForDate: previous lookup failed", previousError);
      return { data: null, error: "NLV/P&L konnten nicht geladen werden." };
    }

    const previous = previousRows?.[0] ?? null;

    const nlv = (current?.net_liquidation_value as number | null) ?? null;
    const previousNlv = (previous?.net_liquidation_value as number | null) ?? null;
    const dailyPnlDollar = nlv != null && previousNlv != null ? nlv - previousNlv : null;
    const dailyPnlPct = dailyPnlDollar != null && previousNlv ? (dailyPnlDollar / previousNlv) * 100 : null;

    return {
      data: {
        nlv,
        nlvTradingDate: currentTradingDate,
        previousNlv,
        previousTradingDate: (previous?.trading_date as string | null) ?? null,
        dailyPnlDollar,
        dailyPnlPct,
        capturedAt: (current?.captured_at as string | null) ?? null,
        baseCurrency: (current?.base_currency as string | null) ?? null,
        source: (current?.source as string | null) ?? null,
      },
      error: null,
    };
  } catch (e) {
    console.error("getDailyPnlSnapshotForDate failed", e);
    return { data: null, error: "NLV/P&L konnten nicht geladen werden." };
  }
}
