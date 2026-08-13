// Provider-agnostic broker interface (JOURNAL_OS_DATA_INTEGRATION_
// ARCHITECTURE.md §1/§15). UI and server actions must only ever import
// from lib/broker, never a concrete provider file directly.
//
// No concrete provider is implemented yet: this environment has neither
// IBKR_FLEX_TOKEN nor IBKR_FLEX_QUERY_ID. Add ibkr-flex-provider.ts
// implementing BrokerProvider once both exist and never request or
// fabricate credentials in the meantime.

export type ExecutionSide = "BUY" | "SELL";
export type OpenClose = "OPEN" | "CLOSE" | "UNKNOWN";

export type RawExecution = {
  providerExecutionId: string | null;
  orderId: string | null;
  symbol: string;
  assetClass: string | null;
  side: ExecutionSide;
  quantity: number;
  price: number | null;
  // ISO 8601 with timezone offset, as delivered by the broker.
  executedAt: string;
  commission: number | null;
  commissionCurrency: string | null;
  openClose: OpenClose;
  currency: string | null;
  rawPayload: Record<string, unknown>;
};

export type RawAccountSnapshot = {
  providerAccountId: string;
  capturedAt: string;
  netLiquidationValue: number | null;
  startOfDayNlv: number | null;
  cash: number | null;
  buyingPower: number | null;
  grossPositionValue: number | null;
  grossExposurePct: number | null;
  netExposurePct: number | null;
  realizedPnlDay: number | null;
  unrealizedPnl: number | null;
  unrealizedPnlDay: number | null;
  maintenanceMargin: number | null;
  availableFunds: number | null;
  excessLiquidity: number | null;
  baseCurrency: string | null;
};

export interface BrokerProvider {
  readonly name: string;

  fetchExecutions(params: { periodStart: string; periodEnd: string }): Promise<RawExecution[]>;

  fetchAccountSnapshot(): Promise<RawAccountSnapshot>;
}
