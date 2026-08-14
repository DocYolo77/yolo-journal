// Normalizes REAL IBKR Flex Web Service XML (verified live against
// account U6479932 on 2026-08-14 — see the two YOLO_JOURNAL_TRADES /
// YOLO_JOURNAL_ACCOUNT Flex Query responses this was built from) into
// the shapes broker_executions / broker_account_snapshots /
// broker_positions_snapshots expect. Pure functions apart from XML
// extraction — no I/O — testable with fixture XML independent of a live
// sync.
//
// Field coverage is exactly what these two Flex Queries return today;
// anything not present in the verified XML (buying_power,
// maintenance_margin, provider_contract_id, daily_pnl, ...) stays null
// rather than guessed, same discipline as lib/broker/ibkr-mcp-normalize.ts.

import { extractElements, extractFirstElement } from "./ibkr-flex-xml";
import { parseIbkrDateToIsoDate, parseIbkrEtDateTimeToIso } from "./ibkr-flex-time";
import type { RawExecution } from "./provider";

// ---- Trades (type="TCF", <TradeConfirm .../> elements) ----

/**
 * One <TradeConfirm> element's verified attributes:
 * accountId, symbol, buySell ("BUY"|"SELL"), quantity (SIGNED — negative
 * for SELL), price, dateTime ("YYYYMMDD;HHMMSS", ET wall-clock), execID
 * (stable, unique per fill), orderID, commission (signed, negative =
 * cost), currency, assetCategory. No openCloseIndicator column in this
 * query configuration.
 */
export function parseTradeConfirms(xml: string): RawExecution[] {
  return extractElements(xml, "TradeConfirm").map((attrs) => {
    const side: RawExecution["side"] = attrs.buySell === "SELL" ? "SELL" : "BUY";
    return {
      providerExecutionId: attrs.execID || null,
      orderId: attrs.orderID || null,
      symbol: attrs.symbol,
      assetClass: attrs.assetCategory || null,
      side,
      quantity: Math.abs(Number(attrs.quantity)),
      price: attrs.price ? Number(attrs.price) : null,
      executedAt: parseIbkrEtDateTimeToIso(attrs.dateTime),
      commission: attrs.commission ? Number(attrs.commission) : null,
      // No separate commission-currency column in this query; IBKR
      // charges commission in the trade's own currency in the vast
      // majority of cases (same documented assumption as the MCP path).
      commissionCurrency: attrs.currency || null,
      // Not derivable from a single TradeConfirm in isolation — resolved
      // during campaign reconciliation from the full fill sequence.
      openClose: "UNKNOWN",
      currency: attrs.currency || null,
      rawPayload: attrs,
    };
  });
}

// ---- Account / NLV (type="AF", Activity Flex Query) ----

export type NormalizedFlexAccountSnapshot = {
  provider: "IBKR";
  provider_account_id: string;
  trading_date: string;
  captured_at: string;
  net_liquidation_value: number | null;
  start_of_day_nlv: null;
  cash: number | null;
  buying_power: null;
  gross_position_value: number | null;
  gross_exposure_pct: number | null;
  net_exposure_pct: null;
  realized_pnl_day: null;
  unrealized_pnl: number | null;
  unrealized_pnl_day: null;
  maintenance_margin: null;
  available_funds: null;
  excess_liquidity: null;
  base_currency: string | null;
  source: "ibkr_flex_sync";
};

const NUM_FIELDS = [
  "total",
  "cash",
  "stock",
  "options",
  "bonds",
  "commodities",
  "funds",
] as const;

/**
 * Builds an account snapshot from the most recent
 * <EquitySummaryByReportDateInBase> row (the Activity query can return
 * more than one trailing row; the highest reportDate is "now") plus the
 * "Total (All Assets)" <FIFOPerformanceSummaryUnderlying> row for
 * unrealized PnL. capturedAt is when this sync actually ran — distinct
 * from tradingDate, which is IBKR's own statement reportDate.
 */
export function normalizeFlexAccountSnapshot(
  xml: string,
  params: { capturedAt: string }
): NormalizedFlexAccountSnapshot | null {
  const equityRows = extractElements(xml, "EquitySummaryByReportDateInBase");
  if (equityRows.length === 0) return null;

  const latest = equityRows.reduce((best, row) => (row.reportDate > best.reportDate ? row : best));
  const values = Object.fromEntries(NUM_FIELDS.map((f) => [f, latest[f] ? Number(latest[f]) : 0])) as Record<
    (typeof NUM_FIELDS)[number],
    number
  >;

  const grossPositionValue = values.stock + values.options + values.bonds + values.commodities + values.funds;
  const netLiquidationValue = latest.total ? Number(latest.total) : null;

  const totalPnlRow = extractElements(xml, "FIFOPerformanceSummaryUnderlying").find(
    (row) => row.description === "Total (All Assets)"
  );

  return {
    provider: "IBKR",
    provider_account_id: latest.accountId,
    trading_date: parseIbkrDateToIsoDate(latest.reportDate),
    captured_at: params.capturedAt,
    net_liquidation_value: netLiquidationValue,
    start_of_day_nlv: null,
    cash: latest.cash ? Number(latest.cash) : null,
    buying_power: null,
    gross_position_value: grossPositionValue,
    gross_exposure_pct:
      netLiquidationValue && netLiquidationValue !== 0 ? (grossPositionValue / netLiquidationValue) * 100 : null,
    net_exposure_pct: null,
    realized_pnl_day: null,
    unrealized_pnl: totalPnlRow?.totalUnrealizedPnl ? Number(totalPnlRow.totalUnrealizedPnl) : null,
    unrealized_pnl_day: null,
    maintenance_margin: null,
    available_funds: null,
    excess_liquidity: null,
    base_currency: latest.currency || null,
    source: "ibkr_flex_sync",
  };
}

// ---- Positions (type="AF", <OpenPosition .../> elements) ----

export type NormalizedFlexPosition = {
  provider: "IBKR";
  provider_account_id: string;
  trading_date: string;
  captured_at: string;
  symbol: string;
  provider_contract_id: null;
  asset_class: string | null;
  quantity: number;
  average_price: number | null;
  market_price: number | null;
  market_value: number | null;
  currency: string | null;
  unrealized_pnl: number | null;
  daily_pnl: null;
  raw_payload: Record<string, string>;
};

export function parseOpenPositions(xml: string, params: { capturedAt: string }): NormalizedFlexPosition[] {
  return extractElements(xml, "OpenPosition").map((attrs) => ({
    provider: "IBKR",
    provider_account_id: attrs.accountId,
    trading_date: parseIbkrDateToIsoDate(attrs.reportDate),
    captured_at: params.capturedAt,
    symbol: attrs.symbol,
    // No IBKR contract-id column in this query configuration.
    provider_contract_id: null,
    asset_class: attrs.assetCategory || null,
    quantity: Number(attrs.position),
    average_price: attrs.costBasisPrice ? Number(attrs.costBasisPrice) : null,
    market_price: attrs.markPrice ? Number(attrs.markPrice) : null,
    market_value: attrs.positionValue ? Number(attrs.positionValue) : null,
    currency: attrs.currency || null,
    unrealized_pnl: attrs.fifoPnlUnrealized ? Number(attrs.fifoPnlUnrealized) : null,
    // Not present in this query configuration.
    daily_pnl: null,
    raw_payload: attrs,
  }));
}

/** The account id a Flex statement belongs to — real IBKR account id (e.g. "U6479932"), not a placeholder. */
export function extractFlexAccountId(xml: string): string | null {
  return extractFirstElement(xml, "FlexStatement")?.accountId ?? null;
}
