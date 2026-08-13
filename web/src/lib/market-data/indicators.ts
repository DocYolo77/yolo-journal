export type DailyBar = { timestamp: string; open: number; high: number; low: number; close: number };

/**
 * Average True Range over `period` daily bars (default 14, Wilder's
 * standard). Massive has no native ATR endpoint (only EMA/SMA/MACD/RSI
 * under technical-indicators), so this is computed from daily OHLC bars
 * directly. Pure function, unit-testable without any provider
 * dependency. `bars` must be ascending by timestamp; needs at least
 * `period + 1` bars (one extra for the first previous-close reference).
 */
export function computeAtr14(bars: DailyBar[], period = 14): number | null {
  if (bars.length < period + 1) return null;

  const trueRanges: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const bar = bars[i];
    const prevClose = bars[i - 1].close;
    const trueRange = Math.max(
      bar.high - bar.low,
      Math.abs(bar.high - prevClose),
      Math.abs(bar.low - prevClose)
    );
    trueRanges.push(trueRange);
  }

  const lastN = trueRanges.slice(-period);
  return lastN.reduce((sum, tr) => sum + tr, 0) / lastN.length;
}
