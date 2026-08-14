// Full moving-average time series over a bar array — computed locally
// rather than via Massive's per-point indicator endpoints, so a chart's
// bars and its overlay lines are always mutually consistent (same
// source data, same alignment) and so the whole series is available in
// one pass instead of one API call per point. Same reasoning as
// computeAtr14 in indicators.ts (Massive has no native ATR endpoint
// either) — hand-rolled, pure, unit-testable.

export type SeriesBar = { close: number };

/**
 * Simple moving average, aligned 1:1 with `bars` — `null` for indices
 * before `period - 1` (insufficient history), matching how these values
 * are only meaningful once enough prior bars exist.
 */
export function computeSmaSeries(bars: SeriesBar[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(bars.length).fill(null);
  let windowSum = 0;

  for (let i = 0; i < bars.length; i++) {
    windowSum += bars[i].close;
    if (i >= period) {
      windowSum -= bars[i - period].close;
    }
    if (i >= period - 1) {
      result[i] = windowSum / period;
    }
  }

  return result;
}

/**
 * Exponential moving average, aligned 1:1 with `bars`. Seeded with a
 * simple average of the first `period` closes (standard EMA
 * initialization) — `null` before that seed point.
 */
export function computeEmaSeries(bars: SeriesBar[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(bars.length).fill(null);
  if (bars.length < period) return result;

  const multiplier = 2 / (period + 1);

  let seed = 0;
  for (let i = 0; i < period; i++) seed += bars[i].close;
  seed /= period;
  result[period - 1] = seed;

  let prevEma = seed;
  for (let i = period; i < bars.length; i++) {
    const ema = (bars[i].close - prevEma) * multiplier + prevEma;
    result[i] = ema;
    prevEma = ema;
  }

  return result;
}
