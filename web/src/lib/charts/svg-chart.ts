// Hand-rolled inline-SVG chart renderers — pure functions, no charting
// library dependency (keeps the report system "so schlank wie möglich"
// and free of any LLM/rendering-service dependency). The exact same SVG
// string is used for the web report view (embedded inline) and
// rasterized to PNG for the PDF export (see lib/reports/rasterize-svg.ts)
// — one source of chart truth for both.

import { computeMacdSeries, computeSessionVwapSeries } from "@/lib/market-data/series-indicators";
import type { ChartMarker, ChartSeriesPoint, IntradayBarPoint, OrbLevel } from "@/lib/supabase/types";

const COLORS = {
  background: "#0a0a0c",
  border: "#232328",
  foreground: "#f4f4f5",
  mutedForeground: "#9a9aa4",
  candleUp: "#22c55e",
  candleDown: "#ef4444",
  ema10: "#3b82f6",
  ema20: "#a855f7",
  sma50: "#f59e0b",
  sma100: "#22c55e",
  sma200: "#ef4444",
  vwap: "#eab308",
  macdLine: "#3b82f6",
  signalLine: "#f97316",
  histogramPos: "#22c55e",
  histogramNeg: "#ef4444",
  zeroLine: "#4b5563",
  orb: "#9a9aa4",
  markerEntry: "#22c55e",
  markerAdd: "#4ade80",
  markerPartialExit: "#f59e0b",
  markerExit: "#ef4444",
};

const MARKER_COLORS: Record<ChartMarker["event_type"], string> = {
  ENTRY: COLORS.markerEntry,
  ADD: COLORS.markerAdd,
  PARTIAL_EXIT: COLORS.markerPartialExit,
  EXIT: COLORS.markerExit,
};

const WIDTH = 900;

// Daily chart: single price panel, unchanged geometry from before.
const DAILY_HEIGHT = 340;
const DAILY_PADDING = { top: 16, right: 16, bottom: 28, left: 56 };

// Intraday chart: price panel stacked over a MACD(6,20,9,C) panel,
// sharing one x-axis (time labels live under the bottom-most panel).
const INTRADAY_LEFT = 56;
const INTRADAY_RIGHT = 16;
const INTRADAY_PRICE_TOP = 20;
const INTRADAY_PRICE_BOTTOM = 280;
const INTRADAY_MACD_TITLE_Y = 296;
const INTRADAY_MACD_TOP = 302;
const INTRADAY_MACD_BOTTOM = 386;
const INTRADAY_XLABEL_Y = 404;
const INTRADAY_HEIGHT = 420;

function escapeXml(text: string): string {
  return text.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c] as string);
}

function wrapSvg(body: string, height: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" font-family="ui-sans-serif, system-ui, sans-serif"><rect x="0" y="0" width="${WIDTH}" height="${height}" fill="${COLORS.background}" />${body}</svg>`;
}

function emptyChartSvg(message: string, height = DAILY_HEIGHT): string {
  return wrapSvg(
    `<text x="${WIDTH / 2}" y="${height / 2}" fill="${COLORS.mutedForeground}" font-size="13" text-anchor="middle">${escapeXml(message)}</text>`,
    height
  );
}

function polyline(points: string, color: string, strokeWidth = 1.25): string {
  return `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linejoin="round" stroke-linecap="round" />`;
}

function buildLineSegments(
  values: (number | null)[],
  xScale: (i: number) => number,
  yScale: (v: number) => number
): string[] {
  const segments: string[] = [];
  let current: string[] = [];
  values.forEach((v, i) => {
    if (v === null) {
      if (current.length > 1) segments.push(current.join(" "));
      current = [];
      return;
    }
    current.push(`${xScale(i).toFixed(1)},${yScale(v).toFixed(1)}`);
  });
  if (current.length > 1) segments.push(current.join(" "));
  return segments;
}

function pickIndices(length: number, count: number): number[] {
  if (length <= count) return Array.from({ length }, (_, i) => i);
  const step = (length - 1) / (count - 1);
  return Array.from({ length: count }, (_, i) => Math.round(i * step));
}

function pickYTicks(min: number, max: number, count: number): number[] {
  const step = (max - min) / (count - 1 || 1);
  return Array.from({ length: count }, (_, i) => min + i * step);
}

function renderLegend(entries: { label: string; color: string }[], top: number): string {
  const itemWidth = 90;
  const startX = DAILY_PADDING.left;
  const y = top;
  return entries
    .map((entry, i) => {
      const x = startX + i * itemWidth;
      return `<line x1="${x}" x2="${x + 14}" y1="${y}" y2="${y}" stroke="${entry.color}" stroke-width="2" /><text x="${x + 18}" y="${y + 3}" fill="${COLORS.mutedForeground}" font-size="9">${escapeXml(entry.label)}</text>`;
    })
    .join("");
}

function candlestickWidth(count: number, innerWidth: number): number {
  return Math.max(1.5, Math.min(6, (innerWidth / Math.max(count, 1)) * 0.6));
}

function renderCandlesticks(
  bars: { open: number; high: number; low: number; close: number }[],
  xScale: (i: number) => number,
  yScale: (v: number) => number,
  bodyWidth: number
): string {
  return bars
    .map((bar, i) => {
      const isUp = bar.close >= bar.open;
      const color = isUp ? COLORS.candleUp : COLORS.candleDown;
      const x = xScale(i);
      const yHigh = yScale(bar.high);
      const yLow = yScale(bar.low);
      const yOpen = yScale(bar.open);
      const yClose = yScale(bar.close);
      const bodyTop = Math.min(yOpen, yClose);
      const bodyHeight = Math.max(1, Math.abs(yClose - yOpen));
      return (
        `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${yHigh.toFixed(1)}" y2="${yLow.toFixed(1)}" stroke="${color}" stroke-width="1" />` +
        `<rect x="${(x - bodyWidth / 2).toFixed(1)}" y="${bodyTop.toFixed(1)}" width="${bodyWidth.toFixed(1)}" height="${bodyHeight.toFixed(1)}" fill="${color}" />`
      );
    })
    .join("");
}

/**
 * Daily chart: OHLC candlesticks plus EMA10/EMA20/SMA50/SMA100/SMA200
 * overlays, all from the same fetched-bar series (chart-data.ts).
 */
export function renderDailyChartSvg(ticker: string, series: ChartSeriesPoint[]): string {
  if (series.length === 0) {
    return emptyChartSvg(`${ticker} — Daily: keine Marktdaten verfügbar`);
  }

  const numericValues = (values: (number | null)[]) => values.filter((v): v is number => v !== null);
  const allValues = [
    ...series.map((p) => p.high),
    ...series.map((p) => p.low),
    ...numericValues(series.map((p) => p.ema10)),
    ...numericValues(series.map((p) => p.ema20)),
    ...numericValues(series.map((p) => p.sma50)),
    ...numericValues(series.map((p) => p.sma100)),
    ...numericValues(series.map((p) => p.sma200)),
  ];
  const minV = Math.min(...allValues);
  const maxV = Math.max(...allValues);
  const pad = (maxV - minV) * 0.06 || Math.max(1, minV * 0.05);
  const domainMin = minV - pad;
  const domainMax = maxV + pad;

  const innerWidth = WIDTH - DAILY_PADDING.left - DAILY_PADDING.right;
  const innerHeight = DAILY_HEIGHT - DAILY_PADDING.top - DAILY_PADDING.bottom;

  const xScale = (i: number) =>
    DAILY_PADDING.left + (series.length === 1 ? innerWidth / 2 : (i / (series.length - 1)) * innerWidth);
  const yScale = (v: number) =>
    DAILY_PADDING.top + innerHeight - ((v - domainMin) / (domainMax - domainMin || 1)) * innerHeight;

  const yTicks = pickYTicks(domainMin, domainMax, 5);
  const gridAndYLabels = yTicks
    .map(
      (v) =>
        `<line x1="${DAILY_PADDING.left}" x2="${WIDTH - DAILY_PADDING.right}" y1="${yScale(v).toFixed(1)}" y2="${yScale(v).toFixed(1)}" stroke="${COLORS.border}" stroke-width="1" />` +
        `<text x="${DAILY_PADDING.left - 8}" y="${yScale(v).toFixed(1)}" fill="${COLORS.mutedForeground}" font-size="10" text-anchor="end" dominant-baseline="middle">${v.toFixed(2)}</text>`
    )
    .join("");

  const xLabels = pickIndices(series.length, 6)
    .map(
      (i) =>
        `<text x="${xScale(i).toFixed(1)}" y="${DAILY_HEIGHT - 6}" fill="${COLORS.mutedForeground}" font-size="10" text-anchor="middle">${series[i].date.slice(5)}</text>`
    )
    .join("");

  const candles = renderCandlesticks(series, xScale, yScale, candlestickWidth(series.length, innerWidth));

  const maLines = [
    ...buildLineSegments(series.map((p) => p.sma200), xScale, yScale).map((s) => polyline(s, COLORS.sma200)),
    ...buildLineSegments(series.map((p) => p.sma100), xScale, yScale).map((s) => polyline(s, COLORS.sma100)),
    ...buildLineSegments(series.map((p) => p.sma50), xScale, yScale).map((s) => polyline(s, COLORS.sma50)),
    ...buildLineSegments(series.map((p) => p.ema20), xScale, yScale).map((s) => polyline(s, COLORS.ema20)),
    ...buildLineSegments(series.map((p) => p.ema10), xScale, yScale).map((s) => polyline(s, COLORS.ema10)),
  ].join("");

  const legend = renderLegend(
    [
      { label: "EMA10", color: COLORS.ema10 },
      { label: "EMA20", color: COLORS.ema20 },
      { label: "SMA50", color: COLORS.sma50 },
      { label: "SMA100", color: COLORS.sma100 },
      { label: "SMA200", color: COLORS.sma200 },
    ],
    DAILY_PADDING.top - 4
  );

  return wrapSvg(
    `${gridAndYLabels}${candles}${maLines}${xLabels}${legend}` +
      `<text x="${WIDTH - DAILY_PADDING.right}" y="${DAILY_HEIGHT - 6}" fill="${COLORS.mutedForeground}" font-size="10" text-anchor="end">${escapeXml(ticker)} · Daily</text>`,
    DAILY_HEIGHT
  );
}

/**
 * Intraday chart: 5-minute OHLC candlesticks, Session VWAP, ORB high/low
 * horizontal levels (only the ones actually derivable — see
 * computeOrbLevelsFromIntraday), Entry/Add/Partial-Exit/Exit markers
 * from real broker data when available, and a stacked MACD(6,20,9,C)
 * panel underneath sharing the same time axis.
 */
export function renderIntradayChartSvg(
  ticker: string,
  bars: IntradayBarPoint[],
  orbLevels: OrbLevel[],
  markers: ChartMarker[]
): string {
  if (bars.length === 0) {
    return emptyChartSvg(`${ticker} — Intraday: keine Marktdaten verfügbar`, INTRADAY_HEIGHT);
  }

  const innerWidth = WIDTH - INTRADAY_LEFT - INTRADAY_RIGHT;
  const xScale = (i: number) =>
    INTRADAY_LEFT + (bars.length === 1 ? innerWidth / 2 : (i / (bars.length - 1)) * innerWidth);

  const vwap = computeSessionVwapSeries(bars);
  const { macd, signal, histogram } = computeMacdSeries(bars.map((b) => ({ close: b.close })), 6, 20, 9);

  // --- Price panel ---
  const highs = bars.map((b) => b.high);
  const lows = bars.map((b) => b.low);
  const orbValues = orbLevels.flatMap((l) => [l.orh, l.orl]);
  const markerValues = markers.map((m) => m.price);
  const vwapValues = vwap.filter((v): v is number => v !== null);
  const priceAllValues = [...highs, ...lows, ...orbValues, ...markerValues, ...vwapValues];
  const priceMin = Math.min(...priceAllValues);
  const priceMax = Math.max(...priceAllValues);
  const pricePad = (priceMax - priceMin) * 0.08 || Math.max(1, priceMin * 0.05);
  const priceDomainMin = priceMin - pricePad;
  const priceDomainMax = priceMax + pricePad;
  const priceInnerHeight = INTRADAY_PRICE_BOTTOM - INTRADAY_PRICE_TOP;

  const priceYScale = (v: number) =>
    INTRADAY_PRICE_TOP + priceInnerHeight - ((v - priceDomainMin) / (priceDomainMax - priceDomainMin || 1)) * priceInnerHeight;

  const priceYTicks = pickYTicks(priceDomainMin, priceDomainMax, 5);
  const priceGridAndYLabels = priceYTicks
    .map(
      (v) =>
        `<line x1="${INTRADAY_LEFT}" x2="${WIDTH - INTRADAY_RIGHT}" y1="${priceYScale(v).toFixed(1)}" y2="${priceYScale(v).toFixed(1)}" stroke="${COLORS.border}" stroke-width="1" />` +
        `<text x="${INTRADAY_LEFT - 8}" y="${priceYScale(v).toFixed(1)}" fill="${COLORS.mutedForeground}" font-size="10" text-anchor="end" dominant-baseline="middle">${v.toFixed(2)}</text>`
    )
    .join("");

  const candles = renderCandlesticks(bars, xScale, priceYScale, candlestickWidth(bars.length, innerWidth));

  const vwapLine = buildLineSegments(vwap, xScale, priceYScale)
    .map((s) => polyline(s, COLORS.vwap, 1.5))
    .join("");

  const orbLines = orbLevels
    .flatMap((level) => [
      { value: level.orh, label: `M${level.orb_minutes} ORH` },
      { value: level.orl, label: `M${level.orb_minutes} ORL` },
    ])
    .map(
      (l) =>
        `<line x1="${INTRADAY_LEFT}" x2="${WIDTH - INTRADAY_RIGHT}" y1="${priceYScale(l.value).toFixed(1)}" y2="${priceYScale(l.value).toFixed(1)}" stroke="${COLORS.orb}" stroke-width="1" stroke-dasharray="4,3" />` +
        `<text x="${WIDTH - INTRADAY_RIGHT - 4}" y="${(priceYScale(l.value) - 3).toFixed(1)}" fill="${COLORS.orb}" font-size="9" text-anchor="end">${escapeXml(l.label)}</text>`
    )
    .join("");

  const markerDots = markers
    .map((m) => {
      const closestIndex = bars.reduce((best, bar, i) => {
        const diff = Math.abs(new Date(bar.timestamp).getTime() - new Date(m.timestamp).getTime());
        const bestDiff = Math.abs(new Date(bars[best].timestamp).getTime() - new Date(m.timestamp).getTime());
        return diff < bestDiff ? i : best;
      }, 0);
      const color = MARKER_COLORS[m.event_type];
      const x = xScale(closestIndex).toFixed(1);
      const y = priceYScale(m.price).toFixed(1);
      return `<circle cx="${x}" cy="${y}" r="4" fill="${color}" stroke="${COLORS.background}" stroke-width="1" /><text x="${x}" y="${(Number(y) - 8).toFixed(1)}" fill="${color}" font-size="9" text-anchor="middle">${escapeXml(m.label)}</text>`;
    })
    .join("");

  const priceLegend = renderLegend([{ label: "Session VWAP", color: COLORS.vwap }], INTRADAY_PRICE_TOP - 4);

  // --- MACD(6,20,9,C) panel ---
  const macdInnerHeight = INTRADAY_MACD_BOTTOM - INTRADAY_MACD_TOP;
  const macdNumericValues = [...macd, ...signal, ...histogram, 0].filter((v): v is number => v !== null);
  const macdMin = Math.min(...macdNumericValues);
  const macdMax = Math.max(...macdNumericValues);
  const macdPad = (macdMax - macdMin) * 0.1 || Math.max(0.01, Math.abs(macdMin) * 0.1) || 0.01;
  const macdDomainMin = macdMin - macdPad;
  const macdDomainMax = macdMax + macdPad;

  const macdYScale = (v: number) =>
    INTRADAY_MACD_TOP + macdInnerHeight - ((v - macdDomainMin) / (macdDomainMax - macdDomainMin || 1)) * macdInnerHeight;

  const hasMacdData = macd.some((v) => v !== null);

  const macdTitle = `<text x="${INTRADAY_LEFT}" y="${INTRADAY_MACD_TITLE_Y}" fill="${COLORS.mutedForeground}" font-size="10">MACD(6,20,9,C)</text>`;

  let macdPanel = "";
  if (hasMacdData) {
    const zeroLine = `<line x1="${INTRADAY_LEFT}" x2="${WIDTH - INTRADAY_RIGHT}" y1="${macdYScale(0).toFixed(1)}" y2="${macdYScale(0).toFixed(1)}" stroke="${COLORS.zeroLine}" stroke-width="1" />`;

    const histWidth = candlestickWidth(bars.length, innerWidth);
    const histBars = histogram
      .map((h, i) => {
        if (h === null) return "";
        const x = xScale(i);
        const yZero = macdYScale(0);
        const yVal = macdYScale(h);
        const top = Math.min(yZero, yVal);
        const barHeight = Math.max(1, Math.abs(yVal - yZero));
        const color = h >= 0 ? COLORS.histogramPos : COLORS.histogramNeg;
        return `<rect x="${(x - histWidth / 2).toFixed(1)}" y="${top.toFixed(1)}" width="${histWidth.toFixed(1)}" height="${barHeight.toFixed(1)}" fill="${color}" opacity="0.6" />`;
      })
      .join("");

    const macdLine = buildLineSegments(macd, xScale, macdYScale)
      .map((s) => polyline(s, COLORS.macdLine, 1.25))
      .join("");
    const signalLine = buildLineSegments(signal, xScale, macdYScale)
      .map((s) => polyline(s, COLORS.signalLine, 1.25))
      .join("");

    macdPanel = `${zeroLine}${histBars}${macdLine}${signalLine}`;
  } else {
    macdPanel = `<text x="${WIDTH / 2}" y="${(INTRADAY_MACD_TOP + macdInnerHeight / 2).toFixed(1)}" fill="${COLORS.mutedForeground}" font-size="10" text-anchor="middle">nicht genug Bars für MACD</text>`;
  }

  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const xLabels = pickIndices(bars.length, 6)
    .map(
      (i) =>
        `<text x="${xScale(i).toFixed(1)}" y="${INTRADAY_XLABEL_Y}" fill="${COLORS.mutedForeground}" font-size="10" text-anchor="middle">${timeFormatter.format(new Date(bars[i].timestamp))}</text>`
    )
    .join("");

  return wrapSvg(
    `${priceGridAndYLabels}${orbLines}${candles}${vwapLine}${markerDots}${priceLegend}` +
      `${macdTitle}${macdPanel}${xLabels}` +
      `<text x="${WIDTH - INTRADAY_RIGHT}" y="${INTRADAY_XLABEL_Y}" fill="${COLORS.mutedForeground}" font-size="10" text-anchor="end">${escapeXml(ticker)} · 5m RTH</text>`,
    INTRADAY_HEIGHT
  );
}

/**
 * Weekly Review NLV chart (§5) — a simple line of
 * broker_account_snapshots.net_liquidation_value across the trading
 * days available that week. Deliberately not a candlestick (there's no
 * OHLC for an account balance) — a plain line is the honest shape here.
 */
export function renderNlvChartSvg(points: { trading_date: string; net_liquidation_value: number | null }[]): string {
  const valid = points.filter((p): p is { trading_date: string; net_liquidation_value: number } => p.net_liquidation_value !== null);
  if (valid.length === 0) {
    return emptyChartSvg("NLV: keine Broker-Account-Snapshots diese Woche verfügbar");
  }

  const values = valid.map((p) => p.net_liquidation_value);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const pad = (maxV - minV) * 0.1 || Math.max(1, minV * 0.02);
  const domainMin = minV - pad;
  const domainMax = maxV + pad;

  const innerWidth = WIDTH - DAILY_PADDING.left - DAILY_PADDING.right;
  const innerHeight = DAILY_HEIGHT - DAILY_PADDING.top - DAILY_PADDING.bottom;

  const xScale = (i: number) =>
    DAILY_PADDING.left + (valid.length === 1 ? innerWidth / 2 : (i / (valid.length - 1)) * innerWidth);
  const yScale = (v: number) =>
    DAILY_PADDING.top + innerHeight - ((v - domainMin) / (domainMax - domainMin || 1)) * innerHeight;

  const yTicks = pickYTicks(domainMin, domainMax, 5);
  const gridAndYLabels = yTicks
    .map(
      (v) =>
        `<line x1="${DAILY_PADDING.left}" x2="${WIDTH - DAILY_PADDING.right}" y1="${yScale(v).toFixed(1)}" y2="${yScale(v).toFixed(1)}" stroke="${COLORS.border}" stroke-width="1" />` +
        `<text x="${DAILY_PADDING.left - 8}" y="${yScale(v).toFixed(1)}" fill="${COLORS.mutedForeground}" font-size="10" text-anchor="end" dominant-baseline="middle">${v.toFixed(0)}</text>`
    )
    .join("");

  const xLabels = pickIndices(valid.length, 5)
    .map(
      (i) =>
        `<text x="${xScale(i).toFixed(1)}" y="${DAILY_HEIGHT - 6}" fill="${COLORS.mutedForeground}" font-size="10" text-anchor="middle">${valid[i].trading_date.slice(5)}</text>`
    )
    .join("");

  const points_ = valid.map((p, i) => `${xScale(i).toFixed(1)},${yScale(p.net_liquidation_value).toFixed(1)}`).join(" ");
  const dots = valid
    .map((p, i) => `<circle cx="${xScale(i).toFixed(1)}" cy="${yScale(p.net_liquidation_value).toFixed(1)}" r="2.5" fill="${COLORS.vwap}" />`)
    .join("");

  return wrapSvg(
    `${gridAndYLabels}${polyline(points_, COLORS.vwap, 1.75)}${dots}${xLabels}` +
      `<text x="${WIDTH - DAILY_PADDING.right}" y="${DAILY_HEIGHT - 6}" fill="${COLORS.mutedForeground}" font-size="10" text-anchor="end">NLV</text>`,
    DAILY_HEIGHT
  );
}
