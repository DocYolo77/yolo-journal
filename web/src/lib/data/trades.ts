import { getSupabaseAdmin } from "@/lib/supabase/server";
import type {
  AccountRow,
  ExecutionRow,
  StrategyRow,
  TagRow,
  TradeMetricsRow,
  TradeRow,
} from "@/lib/supabase/types";

export type TradeSortDirection = "asc" | "desc";

export type TradeListItem = TradeRow & {
  account: Pick<AccountRow, "id" | "name"> | null;
  strategy: Pick<StrategyRow, "id" | "name"> | null;
  metrics: Pick<TradeMetricsRow, "r_multiple" | "net_pnl"> | null;
};

export type TradeDetail = TradeRow & {
  account: Pick<AccountRow, "id" | "name"> | null;
  strategy: Pick<StrategyRow, "id" | "name"> | null;
  metrics: TradeMetricsRow | null;
  executions: ExecutionRow[];
  tags: Pick<TagRow, "id" | "name">[];
};

// Raw shape returned by the embedded select in getTradeById, before we
// flatten the trade_tags join table into a plain `tags` array.
type TradeDetailRaw = TradeRow & {
  account: Pick<AccountRow, "id" | "name"> | null;
  strategy: Pick<StrategyRow, "id" | "name"> | null;
  metrics: TradeMetricsRow | null;
  executions: ExecutionRow[];
  trade_tags: { tag: Pick<TagRow, "id" | "name"> | null }[];
};

export async function listTrades(
  options: { sortDirection?: TradeSortDirection } = {}
): Promise<
  { data: TradeListItem[]; error: null } | { data: null; error: string }
> {
  const sortDirection = options.sortDirection === "asc" ? "asc" : "desc";

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("trades")
      .select(
        "*, account:accounts(id, name), strategy:strategies(id, name), metrics:trade_metrics(r_multiple, net_pnl)"
      )
      .order("opened_at", {
        ascending: sortDirection === "asc",
        nullsFirst: false,
      });

    if (error) {
      console.error("listTrades failed", error);
      return { data: null, error: "Trades konnten nicht geladen werden." };
    }

    return { data: data as unknown as TradeListItem[], error: null };
  } catch (e) {
    console.error("listTrades failed", e);
    return { data: null, error: "Trades konnten nicht geladen werden." };
  }
}

export async function getTradeById(id: string): Promise<
  | { data: TradeDetail; error: null; notFound?: false }
  | { data: null; error: string; notFound: boolean }
> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("trades")
      .select(
        `*,
        account:accounts(id, name),
        strategy:strategies(id, name),
        metrics:trade_metrics(*),
        executions(*),
        trade_tags(tag:tags(id, name))`
      )
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("getTradeById failed", error);
      return {
        data: null,
        error: "Trade konnte nicht geladen werden.",
        notFound: false,
      };
    }

    if (!data) {
      return { data: null, error: "Trade nicht gefunden.", notFound: true };
    }

    const raw = data as unknown as TradeDetailRaw;
    const { trade_tags, executions, ...trade } = raw;

    return {
      data: {
        ...trade,
        executions: [...executions].sort(
          (a, b) =>
            new Date(a.executed_at).getTime() -
            new Date(b.executed_at).getTime()
        ),
        tags: trade_tags
          .map((t) => t.tag)
          .filter((tag): tag is Pick<TagRow, "id" | "name"> => tag !== null),
      },
      error: null,
    };
  } catch (e) {
    console.error("getTradeById failed", e);
    return {
      data: null,
      error: "Trade konnte nicht geladen werden.",
      notFound: false,
    };
  }
}
