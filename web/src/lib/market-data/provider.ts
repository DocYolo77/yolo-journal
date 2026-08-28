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

export type IndexExtensionSnapshot = {
  price: number | null;
  sma50: number | null;
  atr14: number | null;
  /** computeAtrPctExtensionFromMa(price, sma50, atr14) — null if any input is missing. */
  atrExtensionMultiple: number | null;
  /**
   * Set only when atrExtensionMultiple is null — names exactly which
   * input(s) came back empty from Massive (e.g. "SMA50: 0 Werte,
   * ATR14: 0 Bars") so a silent-empty API response (permission/plan
   * restriction, bad date range, etc.) is visible instead of just three
   * dashes with no lead on the cause.
   */
  diagnostic?: string;
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
   * Live ATR%-extension from an index's 50-day MA — the Commitment's
   * Index-Lage (QQQ/SPY) section (§2; the 0.5% risk cap at ATR-Multiple
   * >= 8 is QQQ-specific per the legacy reference, SPY is a parallel
   * reading only) and the Committed Focus Audit's
   * sma50_atr_extension_at_entry (§7). Combines a current/live index
   * price with D-1 SMA50/ATR14 (daily indicators only update once per
   * session).
   */
  getIndexExtension(params: { ticker: "QQQ" | "SPY"; tradeDate: string }): Promise<IndexExtensionSnapshot>;

  /**
   * Daily bars over an explicit [from, to] range, ascending by
   * timestamp — distinct from getOhlcBars, which is always a single
   * day. Used for the Daily Report's multi-month daily chart (needs
   * enough warmup history for SMA200 to be valid at the start of the
   * visible window). `to` is caller-controlled — the Daily Report
   * always passes trade_date itself (a day that has already happened
   * by review time), never a future date.
   */
  getDailyBarsRange(params: { ticker: string; from: string; to: string }): Promise<OhlcBar[]>;

  /**
   * Intraday bars over an explicit [from, to] calendar-date range,
   * ascending by timestamp — used to fetch prior-session 5-minute bars
   * to seed MACD's EMA(20)+EMA(9) before the first visible RTH bar of a
   * trade_date (see chart-data.ts's getIntradayWarmupBars). Unlike
   * getOhlcBars this can span multiple days, so weekends/holidays are
   * simply days that come back with zero bars rather than needing an
   * explicit trading calendar.
   */
  getIntradayBarsRange(params: {
    ticker: string;
    from: string;
    to: string;
    interval: OhlcInterval;
  }): Promise<OhlcBar[]>;
}
