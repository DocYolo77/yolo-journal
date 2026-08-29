// Normalizes a validated manual IBKR JSON import into the exact same
// shapes lib/broker/ibkr-flex-normalize.ts produces from Flex XML
// (RawExecution / NormalizedFlexAccountSnapshot / NormalizedFlexPosition)
// — the whole point of this file is that nothing downstream of
// normalization (campaign reconciliation, Daily Review, MTD-auto, the
// loss-streak counter, Weekly Review) can tell the difference between a
// Flex-synced day and a manually-imported one. Call
// ibkr-json-validate.ts's validateIbkrJsonImport first; this assumes
// its input already passed validation.

import type { RawExecution } from "./provider";
import type { NormalizedFlexAccountSnapshot, NormalizedFlexPosition } from "./ibkr-flex-normalize";
import type { IbkrJsonImport } from "./ibkr-json-types";

// No real IBKR account id in this JSON schema (unlike the Flex XML,
// which carries FlexStatement.accountId) — provider_account_id is pure
// descriptive metadata (no read path filters by it, see
// lib/data/portfolio.ts), so a fixed sentinel is fine unless the JSON
// supplies its own account_id.
const FALLBACK_ACCOUNT_ID = "MANUAL_IMPORT";

export function normalizeJsonExecutions(json: IbkrJsonImport): RawExecution[] {
  return json.executions.map((e) => {
    const side = e.side.toUpperCase() === "SELL" ? "SELL" : "BUY";
    const openClose = e.open_close?.toUpperCase();
    return {
      providerExecutionId: e.exec_id,
      orderId: e.order_id ?? null,
      symbol: e.symbol,
      assetClass: e.asset_class ?? null,
      side,
      quantity: Math.abs(e.quantity),
      price: e.price ?? null,
      executedAt: new Date(e.trade_datetime).toISOString(),
      commission: e.commission ?? null,
      commissionCurrency: e.commission_currency ?? null,
      openClose: openClose === "OPEN" || openClose === "CLOSE" ? openClose : "UNKNOWN",
      // Not part of this JSON schema's execution fields (only
      // commission_currency and fx_rate_to_base are) — not modeled
      // rather than guessed, same discipline as the Flex normalizer.
      currency: null,
      rawPayload: e as unknown as Record<string, unknown>,
    };
  });
}

export function normalizeJsonAccountSnapshot(
  json: IbkrJsonImport,
  params: { importedAt: string }
): NormalizedFlexAccountSnapshot {
  const snapshot = json.account_snapshot;
  const exposure = snapshot.exposure ?? null;

  return {
    provider: "IBKR",
    provider_account_id: json.account_id ?? FALLBACK_ACCOUNT_ID,
    trading_date: json.review_date,
    // snapshot_datetime is when the ORIGINAL tool captured this data —
    // more meaningful than "now" (when re-importing an old file) and,
    // combined with the unique(provider, provider_account_id,
    // trading_date, captured_at) constraint, makes re-importing the
    // exact same file idempotent via upsert (§10) instead of piling up
    // duplicate snapshot rows.
    captured_at: json.snapshot_datetime ?? params.importedAt,
    net_liquidation_value: snapshot.net_liquidation_value ?? null,
    start_of_day_nlv: snapshot.start_of_day_net_liquidation_value ?? null,
    cash: snapshot.cash ?? null,
    buying_power: snapshot.buying_power ?? null,
    gross_position_value: exposure?.gross_exposure ?? null,
    gross_exposure_pct: exposure?.gross_exposure_pct_nlv != null ? exposure.gross_exposure_pct_nlv * 100 : null,
    net_exposure_pct: null,
    realized_pnl_day: snapshot.realized_pnl_day ?? null,
    unrealized_pnl: snapshot.unrealized_pnl ?? null,
    unrealized_pnl_day: snapshot.unrealized_pnl_day ?? null,
    maintenance_margin: null,
    available_funds: null,
    excess_liquidity: null,
    base_currency: json.base_currency,
    source: "manual_json_import",
  };
}

export function normalizeJsonPositions(json: IbkrJsonImport, params: { importedAt: string }): NormalizedFlexPosition[] {
  const capturedAt = json.snapshot_datetime ?? params.importedAt;
  return json.positions.map((p) => ({
    provider: "IBKR",
    provider_account_id: json.account_id ?? FALLBACK_ACCOUNT_ID,
    trading_date: json.review_date,
    captured_at: capturedAt,
    symbol: p.symbol,
    provider_contract_id: p.contract_id ?? null,
    asset_class: p.asset_class ?? null,
    quantity: p.quantity,
    average_price: p.average_price ?? null,
    market_price: p.market_price ?? null,
    market_value: p.market_value ?? null,
    currency: p.currency ?? null,
    unrealized_pnl: p.unrealized_pnl ?? null,
    daily_pnl: p.unrealized_pnl_day ?? null,
    raw_payload: p as unknown as Record<string, unknown>,
  }));
}
