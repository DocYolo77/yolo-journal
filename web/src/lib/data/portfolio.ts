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

export type DailyPnlSnapshot = {
  /** net_liquidation_value from the snapshot whose trading_date == the reviewed date, or null if none was synced for that day. */
  nlv: number | null;
  previousNlv: number | null;
  previousTradingDate: string | null;
  dailyPnlDollar: number | null;
  dailyPnlPct: number | null;
  capturedAt: string | null;
  baseCurrency: string | null;
};

/**
 * NLV for `tradeDate` plus day-over-day P&L against the nearest EARLIER
 * trading_date's snapshot — both read from broker_account_snapshots,
 * which is append-only/historized specifically so this kind of NLV move
 * stays reconstructable (see 20260813180619_..._broker_schema.sql).
 * Deliberately scoped to the exact trade_date being reviewed rather than
 * "whatever the latest sync says" — a Daily Review for a past day must
 * never be pre-filled with a later day's NLV.
 */
export async function getDailyPnlSnapshotForDate(
  tradeDate: string
): Promise<{ data: DailyPnlSnapshot; error: null } | { data: null; error: string }> {
  try {
    const supabase = getSupabaseAdmin();

    const [{ data: currentRows, error: currentError }, { data: previousRows, error: previousError }] =
      await Promise.all([
        supabase
          .from("broker_account_snapshots")
          .select("net_liquidation_value, captured_at, base_currency")
          .eq("trading_date", tradeDate)
          .order("captured_at", { ascending: false })
          .limit(1),
        supabase
          .from("broker_account_snapshots")
          .select("net_liquidation_value, trading_date")
          .lt("trading_date", tradeDate)
          .order("trading_date", { ascending: false })
          .order("captured_at", { ascending: false })
          .limit(1),
      ]);

    if (currentError || previousError) {
      console.error("getDailyPnlSnapshotForDate failed", currentError, previousError);
      return { data: null, error: "NLV/P&L konnten nicht geladen werden." };
    }

    const current = currentRows?.[0] ?? null;
    const previous = previousRows?.[0] ?? null;

    const nlv = (current?.net_liquidation_value as number | null) ?? null;
    const previousNlv = (previous?.net_liquidation_value as number | null) ?? null;
    const dailyPnlDollar = nlv != null && previousNlv != null ? nlv - previousNlv : null;
    const dailyPnlPct = dailyPnlDollar != null && previousNlv ? (dailyPnlDollar / previousNlv) * 100 : null;

    return {
      data: {
        nlv,
        previousNlv,
        previousTradingDate: (previous?.trading_date as string | null) ?? null,
        dailyPnlDollar,
        dailyPnlPct,
        capturedAt: (current?.captured_at as string | null) ?? null,
        baseCurrency: (current?.base_currency as string | null) ?? null,
      },
      error: null,
    };
  } catch (e) {
    console.error("getDailyPnlSnapshotForDate failed", e);
    return { data: null, error: "NLV/P&L konnten nicht geladen werden." };
  }
}
