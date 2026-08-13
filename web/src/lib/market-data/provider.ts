// Provider-agnostic market data interface (JOURNAL_OS_DATA_INTEGRATION_
// ARCHITECTURE.md §1/§15). UI and server actions must only ever import
// from lib/market-data, never a concrete provider file directly.
//
// No concrete provider is implemented yet: this environment has neither
// a MASSIVE_API_KEY nor documented access to the Massive API. Add
// massive-provider.ts implementing MarketDataProvider once both exist —
// per §2, if the key is missing, build against process.env and never
// request or fabricate one.

export type OhlcBar = {
  // ISO 8601 instant; always resolved against America/New_York for
  // session-relative logic (never a hardcoded UTC offset).
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type OhlcInterval = "1m" | "5m" | "15m" | "30m" | "1d";

export type IndicatorSnapshot = {
  close: number;
  ema10: number | null;
  ema20: number | null;
  sma50: number | null;
  sma100: number | null;
  sma200: number | null;
  atr14: number | null;
};

export type QqqExtensionSnapshot = {
  price: number | null;
  sma50: number | null;
  atr14: number | null;
  /** computeAtrPctExtensionFromMa(price, sma50, atr14) — null if any input is missing. */
  atrExtensionMultiple: number | null;
};

export interface MarketDataProvider {
  readonly name: string;

  /** RTH intraday or daily bars for a single ticker, ascending by timestamp. */
  getOhlcBars(params: {
    ticker: string;
    tradeDate: string; // YYYY-MM-DD, America/New_York session
    interval: OhlcInterval;
  }): Promise<OhlcBar[]>;

  /** D-1 (prior session) daily indicators only — no future leakage. */
  getPriorSessionIndicators(params: {
    ticker: string;
    tradeDate: string;
  }): Promise<IndicatorSnapshot | null>;

  /** QQQ/SPY snapshot for the Pre-Market Commitment's market_snapshot block. */
  getIndexSnapshot(params: { tradeDate: string }): Promise<Record<string, unknown>>;

  /**
   * Live QQQ ATR%-extension from its 50-day MA — the Commitment's
   * QQQ-Extension section (§2, triggers the 0.5% risk cap at >= 8) and
   * the Committed Focus Audit's sma50_atr_extension_at_entry (§7,
   * legacy reference). Combines a current/live QQQ price with D-1
   * SMA50/ATR14 (daily indicators only update once per session).
   */
  getQqqExtension(params: { tradeDate: string }): Promise<QqqExtensionSnapshot>;
}
