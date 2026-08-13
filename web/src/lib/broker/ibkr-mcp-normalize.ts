import { createHash } from "node:crypto";
import type { IbkrMcpAccountSummary, IbkrMcpBalanceEntry, IbkrMcpTrade } from "./ibkr-mcp-types";

// Normalizes the real Interactive_Brokers_IBKR MCP connector responses
// into the shapes the broker_executions / broker_account_snapshots
// tables expect. Pure functions — no I/O, no Supabase/MCP dependency —
// so they're testable with fixture data independent of a live session.
// See docs/ibkr-agent-sync-runbook.md for how a scheduled agent turn
// actually calls the MCP tools and feeds their output through here.

export type NormalizedBrokerExecution = {
  provider: "IBKR";
  provider_execution_id: string;
  dedup_key: string;
  order_id: string | null;
  symbol: string;
  asset_class: string | null;
  side: "BUY" | "SELL";
  quantity: number;
  price: number | null;
  executed_at: string;
  commission: number | null;
  commission_currency: string | null;
  open_close: "OPEN" | "CLOSE" | "UNKNOWN";
  currency: string | null;
  raw_payload: IbkrMcpTrade;
};

export function normalizeIbkrTrade(trade: IbkrMcpTrade): NormalizedBrokerExecution {
  return {
    provider: "IBKR",
    provider_execution_id: trade.trade_id,
    // trade_id is always present and stable for this connector, so this
    // is the real key, never the fallback hash — but computing it the
    // same way as lib/broker/execution-normalize.ts documents intent
    // and gives a fallback if a future response ever omits trade_id.
    dedup_key: trade.trade_id || computeFallbackKey(trade),
    order_id: trade.order_id != null ? String(trade.order_id) : null,
    symbol: trade.symbol,
    asset_class: trade.sec_type || null,
    side: trade.side,
    quantity: trade.size,
    price: trade.price,
    executed_at: trade.trade_time,
    commission: trade.commission,
    // The connector doesn't return a separate commission currency; IBKR
    // charges commission in the trade's own currency in the vast
    // majority of cases, but this is an assumption, not a verified fact.
    commission_currency: trade.currency || null,
    // Never inferable from a single trade row in isolation — resolved
    // later during campaign reconciliation from the full fill sequence
    // for that symbol, per the architecture doc's explicit instruction
    // not to guess this.
    open_close: "UNKNOWN",
    currency: trade.currency || null,
    raw_payload: trade,
  };
}

function computeFallbackKey(trade: IbkrMcpTrade): string {
  const input = [trade.symbol, trade.side, trade.size, trade.price, trade.trade_time, trade.order_id].join("|");
  return createHash("sha256").update(input).digest("hex");
}

export type NormalizedBrokerAccountSnapshot = {
  provider: "IBKR";
  provider_account_id: string;
  trading_date: string;
  captured_at: string;
  net_liquidation_value: number | null;
  // Not returned by get_account_summary or get_account_balances — no
  // verified source for this yet. Left null rather than guessed.
  start_of_day_nlv: null;
  cash: number | null;
  buying_power: number | null;
  gross_position_value: number | null;
  // Derived: gross_position_value / net_liquidation_value. Cross-checked
  // against a real captured sample where it landed at ~1.207, matching
  // IBKR's own reported `leverage: "1.21"` field almost exactly - this
  // is a real calculation, not an invented number.
  gross_exposure_pct: number | null;
  // Would need a long/short position breakdown to compute correctly;
  // not derivable from summary/balances alone. Left null.
  net_exposure_pct: null;
  // get_account_balances returns a `realized_pnl` per currency, but
  // nothing in the response says whether it's today-only or cumulative
  // (YTD/all-time). Rather than guess, this stays null until verified
  // against IBKR directly; the raw value is still visible in whatever
  // caller logs the original MCP response.
  realized_pnl_day: null;
  unrealized_pnl: number | null;
  unrealized_pnl_day: null;
  maintenance_margin: number | null;
  available_funds: number | null;
  excess_liquidity: number | null;
  base_currency: string | null;
  source: "ibkr_mcp_agent_sync";
};

/**
 * `providerAccountId` has no source field in any of these MCP responses
 * (the connector is implicitly scoped to a single connected account) -
 * it must be supplied by the caller, not guessed from the data.
 */
export function normalizeIbkrAccountSnapshot(params: {
  summary: IbkrMcpAccountSummary;
  balances: IbkrMcpBalanceEntry[];
  providerAccountId: string;
  tradingDate: string;
  capturedAt: string;
}): NormalizedBrokerAccountSnapshot {
  const baseBalance = params.balances.find((b) => b.currency === "BASE") ?? null;

  const grossExposurePct =
    params.summary.net_liquidation && params.summary.net_liquidation !== 0
      ? (params.summary.gross_position_value / params.summary.net_liquidation) * 100
      : null;

  return {
    provider: "IBKR",
    provider_account_id: params.providerAccountId,
    trading_date: params.tradingDate,
    captured_at: params.capturedAt,
    net_liquidation_value: params.summary.net_liquidation ?? null,
    start_of_day_nlv: null,
    cash: params.summary.total_cash_value ?? null,
    buying_power: params.summary.buying_power ?? null,
    gross_position_value: params.summary.gross_position_value ?? null,
    gross_exposure_pct: grossExposurePct,
    net_exposure_pct: null,
    realized_pnl_day: null,
    unrealized_pnl: baseBalance?.unrealized_pnl ?? null,
    unrealized_pnl_day: null,
    maintenance_margin: params.summary.maintenance_margin ?? null,
    available_funds: params.summary.available_funds ?? null,
    excess_liquidity: params.summary.excess_liquidity ?? null,
    base_currency: params.summary.currency ?? null,
    source: "ibkr_mcp_agent_sync",
  };
}
