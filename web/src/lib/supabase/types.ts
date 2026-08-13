// Hand-written types matching supabase/migrations/*.sql.
// No codegen/ORM is used (per project rules) — keep this in sync manually
// whenever a migration changes these tables.

export type TradeDirection = "long" | "short";
export type TradeStatus = "planned" | "open" | "closed" | "cancelled";
export type AssetClass =
  | "stock"
  | "etf"
  | "option"
  | "future"
  | "forex"
  | "crypto"
  | "index"
  | "other";
export type ExecutionSide = "buy" | "sell";
export type ExecutionType = "fill" | "fee" | "adjustment";

export type TradeRow = {
  id: string;
  account_id: string | null;
  strategy_id: string | null;
  symbol: string;
  asset_class: AssetClass;
  direction: TradeDirection;
  status: TradeStatus;
  opened_at: string | null;
  closed_at: string | null;
  planned_entry: number | null;
  initial_stop: number | null;
  initial_risk_amount: number | null;
  initial_risk_pct: number | null;
  thesis: string | null;
  notes: string | null;
  mistake_notes: string | null;
  process_rating: number | null;
  created_at: string;
  updated_at: string;
};

export type AccountRow = {
  id: string;
  name: string;
  broker: string | null;
  base_currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type StrategyRow = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ExecutionRow = {
  id: string;
  trade_id: string;
  side: ExecutionSide;
  execution_type: ExecutionType;
  executed_at: string;
  quantity: number;
  price: number | null;
  fees: number;
  broker_order_id: string | null;
  notes: string | null;
  created_at: string;
};

export type TradeMetricsRow = {
  trade_id: string;
  avg_entry: number | null;
  avg_exit: number | null;
  gross_pnl: number | null;
  net_pnl: number | null;
  r_multiple: number | null;
  mae_pct: number | null;
  mae_r: number | null;
  mfe_pct: number | null;
  mfe_r: number | null;
  holding_minutes: number | null;
  calculated_at: string;
};

export type TagRow = {
  id: string;
  name: string;
  category: string | null;
};
