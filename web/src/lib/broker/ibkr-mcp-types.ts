// Types matching the REAL response shapes returned by the
// Interactive_Brokers_IBKR MCP connector (verified live against a real
// account on 2026-08-13, not inferred from generic IBKR API docs).
//
// This connector is only reachable from within a Claude agent turn
// (interactive or scheduled), never from the deployed Next.js server
// directly — see docs/ibkr-agent-sync-runbook.md for how the scheduled
// sync actually works and why.

export type IbkrMcpTrade = {
  trade_id: string;
  symbol: string;
  company_name: string;
  sec_type: string; // e.g. "STK"
  currency: string;
  side: "BUY" | "SELL";
  size: number;
  price: number;
  stop_price: number;
  formatted_price: string;
  order_type: string;
  tif: string;
  description: string;
  trade_time: string; // ISO 8601 with Z, e.g. "2026-08-13T14:32:54Z"
  exchange: string;
  commission: number;
  net_amount: number;
  realized_pnl: number;
  order_id: number;
};

export type IbkrMcpPosition = {
  contract_id: number;
  contract_description: string;
  position: number;
  market_price: number;
  market_value: number;
  currency: string;
  average_price: number;
  unrealized_pnl: number;
  daily_pnl: number;
  asset_class: string;
};

export type IbkrMcpAccountSummary = {
  currency: string;
  net_liquidation: number;
  equity_with_loan_value: number;
  buying_power: number;
  gross_position_value: number;
  total_cash_value: number;
  available_funds: number;
  initial_margin: number;
  maintenance_margin: number;
  excess_liquidity: number;
  dividends: number;
  leverage: string;
};

export type IbkrMcpBalanceEntry = {
  currency: string; // "BASE" or an ISO currency code
  cash_balance: number;
  settled_cash: number;
  net_liquidation_value: number;
  stock_market_value: number;
  unrealized_pnl: number;
  realized_pnl: number;
  exchange_rate: number;
};
