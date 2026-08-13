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

/**
 * ATR%-normalized extension of price from a moving average, per the
 * user-specified formula:
 *
 *   A = ATR%              = ATR / price
 *   B = % gain from MA    = (price - movingAverage) / movingAverage
 *   extension             = B / A
 *
 * This is NOT the naive `(price - movingAverage) / atr` — both ATR and
 * the MA gain are expressed as a percentage first, which matters
 * precisely in the "extended" case this metric exists to catch (price
 * has moved meaningfully away from the MA, so price and movingAverage
 * diverge and the naive version and this one give different answers).
 *
 * Used for both the Pre-Market Commitment's QQQ-Extension ("ATR
 * multiple to SMA50", triggers the 0.5% risk cap at >= 8) and the
 * Committed Focus Audit's sma50_atr_extension_at_entry filter (max
 * 5.0x, LEGACY_JOURNAL_OS_V7_4_3_REFERENCE.md §7).
 */
export function computeAtrPctExtensionFromMa(params: {
  price: number;
  movingAverage: number;
  atr: number;
}): number | null {
  if (params.price === 0 || params.movingAverage === 0) return null;

  const atrPct = params.atr / params.price;
  if (atrPct === 0) return null;

  const gainFromMaPct = (params.price - params.movingAverage) / params.movingAverage;
  return gainFromMaPct / atrPct;
}
