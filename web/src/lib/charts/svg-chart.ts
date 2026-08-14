// Hand-rolled inline-SVG chart renderers — pure functions, no charting
// library dependency (keeps the report system "so schlank wie möglich"
// and free of any LLM/rendering-service dependency). The exact same SVG
// string is used for the web report view (embedded inline) and
// rasterized to PNG for the PDF export (see lib/reports/pdf.ts) — one
// source of chart truth for both.
//
// Deliberately line charts, not candlesticks: sufficient for a daily
// report's purpose, and meaningfully simpler/more robust to get right
// than full OHLC candlestick geometry in the time available.

import type { ChartMarker, ChartSeriesPoint, IntradayBarPoint, OrbLevel } from "@/lib/supabase/types";

const COLORS = {
  background: "#0a0a0c",
  border: "#232328",
  foreground: "#f4f4f5",
  mutedForeground: "#9a9aa4",
  price: "#f4f4f5",
  ema10: "#3b82f6",
  ema20: "#a855f7",
  sma50: "#f59e0b",
  sma100: "#22c55e",
  sma200: "#ef4444",
  orb: "#9a9aa4",
  buy: "#22c55e",
  sell: "#ef4444",
};

const WIDTH = 900;
const HEIGHT = 340;
const PADDING = { top: 16, right: 16, bottom: 28, left: 56 };

function escapeXml(text: string): string {
  return text.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c] as string);
}

function wrapSvg(body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" font-family="ui-sans-serif, system-ui, sans-serif"><rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="${COLORS.background}" />${body}</svg>`;
}

function emptyChartSvg(message: string): string {
  return wrapSvg(
    `<text x="${WIDTH / 2}" y="${HEIGHT / 2}" fill="${COLORS.mutedForeground}" font-size="13" text-anchor="middle">${escapeXml(message)}</text>`
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

function renderLegend(entries: { label: string; color: string }[]): string {
  const itemWidth = 90;
  const startX = PADDING.left;
  const y = PADDING.top - 4;
  return entries
    .map((entry, i) => {
      const x = startX + i * itemWidth;
      return `<line x1="${x}" x2="${x + 14}" y1="${y}" y2="${y}" stroke="${entry.color}" stroke-width="2" /><text x="${x + 18}" y="${y + 3}" fill="${COLORS.mutedForeground}" font-size="9">${escapeXml(entry.label)}</text>`;
    })
    .join("");
}

/**
 * Daily chart: close price plus EMA10/EMA20/SMA50/SMA100/SMA200
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

  const innerWidth = WIDTH - PADDING.left - PADDING.right;
  const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;

  const xScale = (i: number) =>
    PADDING.left + (series.length === 1 ? innerWidth / 2 : (i / (series.length - 1)) * innerWidth);
  const yScale = (v: number) =>
    PADDING.top + innerHeight - ((v - domainMin) / (domainMax - domainMin || 1)) * innerHeight;

  const yTicks = pickYTicks(domainMin, domainMax, 5);
  const gridAndYLabels = yTicks
    .map(
      (v) =>
        `<line x1="${PADDING.left}" x2="${WIDTH - PADDING.right}" y1="${yScale(v).toFixed(1)}" y2="${yScale(v).toFixed(1)}" stroke="${COLORS.border}" stroke-width="1" />` +
        `<text x="${PADDING.left - 8}" y="${yScale(v).toFixed(1)}" fill="${COLORS.mutedForeground}" font-size="10" text-anchor="end" dominant-baseline="middle">${v.toFixed(2)}</text>`
    )
    .join("");

  const xLabels = pickIndices(series.length, 6)
    .map(
      (i) =>
        `<text x="${xScale(i).toFixed(1)}" y="${HEIGHT - 6}" fill="${COLORS.mutedForeground}" font-size="10" text-anchor="middle">${series[i].date.slice(5)}</text>`
    )
    .join("");

  const lines = [
    ...buildLineSegments(series.map((p) => p.sma200), xScale, yScale).map((s) => polyline(s, COLORS.sma200)),
    ...buildLineSegments(series.map((p) => p.sma100), xScale, yScale).map((s) => polyline(s, COLORS.sma100)),
    ...buildLineSegments(series.map((p) => p.sma50), xScale, yScale).map((s) => polyline(s, COLORS.sma50)),
    ...buildLineSegments(series.map((p) => p.ema20), xScale, yScale).map((s) => polyline(s, COLORS.ema20)),
    ...buildLineSegments(series.map((p) => p.ema10), xScale, yScale).map((s) => polyline(s, COLORS.ema10)),
    ...buildLineSegments(series.map((p) => p.close), xScale, yScale).map((s) => polyline(s, COLORS.price, 1.75)),
  ].join("");

  const legend = renderLegend([
    { label: "Close", color: COLORS.price },
    { label: "EMA10", color: COLORS.ema10 },
    { label: "EMA20", color: COLORS.ema20 },
    { label: "SMA50", color: COLORS.sma50 },
    { label: "SMA100", color: COLORS.sma100 },
    { label: "SMA200", color: COLORS.sma200 },
  ]);

  return wrapSvg(
    `<text x="${PADDING.left}" y="${PADDING.top - 4 + 3 + 14}" fill="${COLORS.foreground}" font-size="12" font-weight="600"></text>` +
      `${gridAndYLabels}${lines}${xLabels}${legend}` +
      `<text x="${WIDTH - PADDING.right}" y="${HEIGHT - 6}" fill="${COLORS.mutedForeground}" font-size="10" text-anchor="end">${escapeXml(ticker)} · Daily</text>`
  );
}

/**
 * Intraday chart: 5-minute close price, ORB high/low horizontal levels
 * (only the ones actually derivable — see computeOrbLevelsFromIntraday),
 * and entry/add/exit markers from real broker data when available.
 */
export function renderIntradayChartSvg(
  ticker: string,
  bars: IntradayBarPoint[],
  orbLevels: OrbLevel[],
  markers: ChartMarker[]
): string {
  if (bars.length === 0) {
    return emptyChartSvg(`${ticker} — Intraday: keine Marktdaten verfügbar`);
  }

  const closes = bars.map((b) => b.close);
  const highs = bars.map((b) => b.high);
  const lows = bars.map((b) => b.low);
  const orbValues = orbLevels.flatMap((l) => [l.orh, l.orl]);
  const markerValues = markers.map((m) => m.price);
  const allValues = [...highs, ...lows, ...orbValues, ...markerValues];
  const minV = Math.min(...allValues);
  const maxV = Math.max(...allValues);
  const pad = (maxV - minV) * 0.08 || Math.max(1, minV * 0.05);
  const domainMin = minV - pad;
  const domainMax = maxV + pad;

  const innerWidth = WIDTH - PADDING.left - PADDING.right;
  const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;

  const xScale = (i: number) =>
    PADDING.left + (bars.length === 1 ? innerWidth / 2 : (i / (bars.length - 1)) * innerWidth);
  const yScale = (v: number) =>
    PADDING.top + innerHeight - ((v - domainMin) / (domainMax - domainMin || 1)) * innerHeight;

  const yTicks = pickYTicks(domainMin, domainMax, 5);
  const gridAndYLabels = yTicks
    .map(
      (v) =>
        `<line x1="${PADDING.left}" x2="${WIDTH - PADDING.right}" y1="${yScale(v).toFixed(1)}" y2="${yScale(v).toFixed(1)}" stroke="${COLORS.border}" stroke-width="1" />` +
        `<text x="${PADDING.left - 8}" y="${yScale(v).toFixed(1)}" fill="${COLORS.mutedForeground}" font-size="10" text-anchor="end" dominant-baseline="middle">${v.toFixed(2)}</text>`
    )
    .join("");

  const xLabelIndices = pickIndices(bars.length, 6);
  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const xLabels = xLabelIndices
    .map(
      (i) =>
        `<text x="${xScale(i).toFixed(1)}" y="${HEIGHT - 6}" fill="${COLORS.mutedForeground}" font-size="10" text-anchor="middle">${timeFormatter.format(new Date(bars[i].timestamp))}</text>`
    )
    .join("");

  const priceLine = buildLineSegments(closes, xScale, yScale)
    .map((s) => polyline(s, COLORS.price, 1.5))
    .join("");

  const orbLines = orbLevels
    .flatMap((level) => [
      { value: level.orh, label: `M${level.orb_minutes} ORH` },
      { value: level.orl, label: `M${level.orb_minutes} ORL` },
    ])
    .map(
      (l) =>
        `<line x1="${PADDING.left}" x2="${WIDTH - PADDING.right}" y1="${yScale(l.value).toFixed(1)}" y2="${yScale(l.value).toFixed(1)}" stroke="${COLORS.orb}" stroke-width="1" stroke-dasharray="4,3" />` +
        `<text x="${WIDTH - PADDING.right - 4}" y="${(yScale(l.value) - 3).toFixed(1)}" fill="${COLORS.orb}" font-size="9" text-anchor="end">${escapeXml(l.label)}</text>`
    )
    .join("");

  const markerDots = markers
    .map((m) => {
      const closestIndex = bars.reduce((best, bar, i) => {
        const diff = Math.abs(new Date(bar.timestamp).getTime() - new Date(m.timestamp).getTime());
        const bestDiff = Math.abs(new Date(bars[best].timestamp).getTime() - new Date(m.timestamp).getTime());
        return diff < bestDiff ? i : best;
      }, 0);
      const color = m.side === "BUY" ? COLORS.buy : COLORS.sell;
      const x = xScale(closestIndex).toFixed(1);
      const y = yScale(m.price).toFixed(1);
      return `<circle cx="${x}" cy="${y}" r="4" fill="${color}" stroke="${COLORS.background}" stroke-width="1" /><text x="${x}" y="${(Number(y) - 8).toFixed(1)}" fill="${color}" font-size="9" text-anchor="middle">${escapeXml(m.label)}</text>`;
    })
    .join("");

  return wrapSvg(
    `${gridAndYLabels}${orbLines}${priceLine}${markerDots}${xLabels}` +
      `<text x="${WIDTH - PADDING.right}" y="${HEIGHT - 6}" fill="${COLORS.mutedForeground}" font-size="10" text-anchor="end">${escapeXml(ticker)} · 5m RTH</text>`
  );
}
