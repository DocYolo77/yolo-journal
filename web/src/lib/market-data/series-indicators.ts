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

/**
 * EMA over a nullable series (e.g. a MACD line, which is itself only
 * defined once its slow EMA has enough history) — seeds from the first
 * run of non-null values instead of assuming index 0 is valid.
 */
function emaOfNullableSeries(values: (number | null)[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(values.length).fill(null);
  const firstValid = values.findIndex((v) => v !== null);
  if (firstValid === -1 || values.length - firstValid < period) return result;

  const multiplier = 2 / (period + 1);
  let seed = 0;
  for (let i = firstValid; i < firstValid + period; i++) seed += values[i] as number;
  seed /= period;
  const seedIndex = firstValid + period - 1;
  result[seedIndex] = seed;

  let prevEma = seed;
  for (let i = seedIndex + 1; i < values.length; i++) {
    const v = values[i] as number;
    const ema = (v - prevEma) * multiplier + prevEma;
    result[i] = ema;
    prevEma = ema;
  }

  return result;
}

export type MacdSeries = {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
};

/**
 * MACD(fastPeriod, slowPeriod, signalPeriod, Close) — default (6, 20, 9)
 * per the intraday session setup. All three lines are aligned 1:1 with
 * `bars`, `null` wherever there isn't yet enough history.
 */
export function computeMacdSeries(bars: SeriesBar[], fastPeriod = 6, slowPeriod = 20, signalPeriod = 9): MacdSeries {
  const fastEma = computeEmaSeries(bars, fastPeriod);
  const slowEma = computeEmaSeries(bars, slowPeriod);
  const macd = bars.map((_, i) => {
    const f = fastEma[i];
    const s = slowEma[i];
    return f !== null && s !== null ? f - s : null;
  });
  const signal = emaOfNullableSeries(macd, signalPeriod);
  const histogram = macd.map((m, i) => {
    const s = signal[i];
    return m !== null && s !== null ? m - s : null;
  });
  return { macd, signal, histogram };
}

export type VwapBar = { high: number; low: number; close: number; volume: number };

/**
 * Session VWAP — cumulative from the first bar in the array, which is
 * always the RTH session open for the intraday series this feeds (see
 * getIntradayChartSeries). Uses the standard typical-price definition
 * (H+L+C)/3.
 */
export function computeSessionVwapSeries(bars: VwapBar[]): (number | null)[] {
  const result: (number | null)[] = new Array(bars.length).fill(null);
  let cumulativePriceVolume = 0;
  let cumulativeVolume = 0;

  bars.forEach((bar, i) => {
    const typicalPrice = (bar.high + bar.low + bar.close) / 3;
    cumulativePriceVolume += typicalPrice * bar.volume;
    cumulativeVolume += bar.volume;
    result[i] = cumulativeVolume > 0 ? cumulativePriceVolume / cumulativeVolume : null;
  });

  return result;
}
