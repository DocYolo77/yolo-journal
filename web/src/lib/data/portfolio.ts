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
