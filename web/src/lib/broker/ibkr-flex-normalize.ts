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

// Shared shape for BOTH ingestion paths — Flex sync (this file) and the
// manual JSON import (ibkr-json-normalize.ts) — kept here since Flex was
// first, but neither path gets its own type: same fields, nullable
// wherever a given source can't populate them (Flex never has
// start_of_day_nlv/buying_power/etc.; the JSON import schema does).
export type NormalizedFlexAccountSnapshot = {
  provider: "IBKR";
  provider_account_id: string;
  trading_date: string;
  captured_at: string;
  net_liquidation_value: number | null;
  start_of_day_nlv: number | null;
  cash: number | null;
  buying_power: number | null;
  gross_position_value: number | null;
  gross_exposure_pct: number | null;
  net_exposure_pct: number | null;
  realized_pnl_day: number | null;
  unrealized_pnl: number | null;
  unrealized_pnl_day: number | null;
  maintenance_margin: number | null;
  available_funds: number | null;
  excess_liquidity: number | null;
  base_currency: string | null;
  source: "ibkr_flex_sync" | "manual_json_import";
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
 * Builds one account snapshot per <EquitySummaryByReportDateInBase> row
 * — the Activity query's configured period returns a trailing WINDOW of
 * report dates, not just "today" (e.g. the last several calendar days),
 * so a single sync naturally backfills NLV/exposure for every date in
 * that window, not only the most recent one. This is what lets a Daily
 * Review being caught up for a past date (e.g. doing 25./26./27.08 on
 * the 27th) actually get that specific date's real EOD figures — IBKR's
 * Flex Web Service has no per-request date-range parameter (a query's
 * period is fixed in its own IBKR-side definition), so this trailing
 * window is the only lookback mechanism available, and previously only
 * its single latest row was ever kept, discarding the rest.
 *
 * unrealized_pnl (from "Total (All Assets)" in
 * <FIFOPerformanceSummaryUnderlying>) reflects the CURRENT portfolio
 * only — IBKR gives no historical per-day breakdown of it via this
 * query — so it's only ever attached to the row for the latest
 * reportDate; backfilled historical rows keep it null rather than
 * reusing today's number for a different date.
 *
 * capturedAt is when this sync actually ran — distinct from
 * trading_date, which is IBKR's own statement reportDate.
 */
export function normalizeFlexAccountSnapshots(
  xml: string,
  params: { capturedAt: string }
): NormalizedFlexAccountSnapshot[] {
  const equityRows = extractElements(xml, "EquitySummaryByReportDateInBase");
  if (equityRows.length === 0) return [];

  const latestReportDate = equityRows.reduce(
    (best, row) => (row.reportDate > best ? row.reportDate : best),
    equityRows[0].reportDate
  );

  const totalPnlRow = extractElements(xml, "FIFOPerformanceSummaryUnderlying").find(
    (row) => row.description === "Total (All Assets)"
  );

  return equityRows.map((row) => {
    const values = Object.fromEntries(NUM_FIELDS.map((f) => [f, row[f] ? Number(row[f]) : 0])) as Record<
      (typeof NUM_FIELDS)[number],
      number
    >;

    const grossPositionValue = values.stock + values.options + values.bonds + values.commodities + values.funds;
    const netLiquidationValue = row.total ? Number(row.total) : null;
    const isLatest = row.reportDate === latestReportDate;

    return {
      provider: "IBKR",
      provider_account_id: row.accountId,
      trading_date: parseIbkrDateToIsoDate(row.reportDate),
      captured_at: params.capturedAt,
      net_liquidation_value: netLiquidationValue,
      start_of_day_nlv: null,
      cash: row.cash ? Number(row.cash) : null,
      buying_power: null,
      gross_position_value: grossPositionValue,
      gross_exposure_pct:
        netLiquidationValue && netLiquidationValue !== 0 ? (grossPositionValue / netLiquidationValue) * 100 : null,
      net_exposure_pct: null,
      realized_pnl_day: null,
      unrealized_pnl: isLatest && totalPnlRow?.totalUnrealizedPnl ? Number(totalPnlRow.totalUnrealizedPnl) : null,
      unrealized_pnl_day: null,
      maintenance_margin: null,
      available_funds: null,
      excess_liquidity: null,
      base_currency: row.currency || null,
      source: "ibkr_flex_sync",
    };
  });
}

// ---- Positions (type="AF", <OpenPosition .../> elements) ----

// Same "shared shape, not a Flex-only type" note as
// NormalizedFlexAccountSnapshot above — provider_contract_id/daily_pnl
// are null-only from Flex (no such column in that query configuration)
// but real values from the JSON import schema (contract_id/
// unrealized_pnl_day).
export type NormalizedFlexPosition = {
  provider: "IBKR";
  provider_account_id: string;
  trading_date: string;
  captured_at: string;
  symbol: string;
  provider_contract_id: string | null;
  asset_class: string | null;
  quantity: number;
  average_price: number | null;
  market_price: number | null;
  market_value: number | null;
  currency: string | null;
  unrealized_pnl: number | null;
  daily_pnl: number | null;
  raw_payload: Record<string, unknown>;
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
