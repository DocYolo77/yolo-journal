// Shape of the manual IBKR JSON import file/paste — the fallback
// ingestion path for when the automated Flex sync isn't working. See
// ibkr-json-validate.ts for field-level validation and
// ibkr-json-normalize.ts for mapping this into the exact same
// NormalizedFlexAccountSnapshot/NormalizedFlexPosition/RawExecution
// shapes the Flex sync produces — this file only describes the raw,
// as-uploaded JSON structure, unvalidated.

export type IbkrJsonExposure = {
  gross_exposure?: number | null;
  gross_exposure_pct_nlv?: number | null;
  long_exposure?: number | null;
  short_exposure?: number | null;
  net_exposure?: number | null;
};

export type IbkrJsonAccountSnapshot = {
  net_liquidation_value?: number | null;
  start_of_day_net_liquidation_value?: number | null;
  cash?: number | null;
  buying_power?: number | null;
  realized_pnl_day?: number | null;
  unrealized_pnl?: number | null;
  unrealized_pnl_total?: number | null;
  unrealized_pnl_day?: number | null;
  exposure?: IbkrJsonExposure | null;
};

export type IbkrJsonExecution = {
  exec_id: string;
  trade_id?: string | null;
  symbol: string;
  asset_class?: string | null;
  side: string;
  quantity: number;
  price?: number | null;
  stop_price?: number | null;
  stop_source?: string | null;
  stop_reference_date?: string | null;
  trade_datetime: string;
  commission?: number | null;
  commission_currency?: string | null;
  fx_rate_to_base?: number | null;
  open_close?: string | null;
  order_id?: string | null;
};

export type IbkrJsonPosition = {
  contract_id?: string | null;
  symbol: string;
  asset_class?: string | null;
  position_side?: string | null;
  quantity: number;
  currency?: string | null;
  average_price?: number | null;
  market_price?: number | null;
  market_value?: number | null;
  market_value_base?: number | null;
  unrealized_pnl?: number | null;
  unrealized_pnl_base?: number | null;
  unrealized_pnl_day?: number | null;
  unrealized_pnl_day_base?: number | null;
  fx_rate_to_base?: number | null;
  stop_price?: number | null;
  stop_source?: string | null;
  stop_reference_date?: string | null;
  stop_lots?: number | null;
};

export type IbkrJsonImport = {
  schema_version: string;
  review_date: string;
  base_currency: string;
  snapshot_datetime?: string | null;
  account_id?: string | null;
  account_snapshot: IbkrJsonAccountSnapshot;
  positions: IbkrJsonPosition[];
  executions: IbkrJsonExecution[];
  data_quality?: Record<string, unknown>;
};
