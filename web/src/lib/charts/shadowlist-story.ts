// Renders the Shadowlist "Story-Format" export (§3.3) — one tall
// vertical SVG (Instagram-Story-shaped, easy to screenshot-share) with
// one card per watchlist ticker: close, day move, 5-day move, taken
// state, and a compact sparkline built from the same daily chart
// source as everywhere else in the app. Rasterized to PNG via
// lib/reports/rasterize-svg.ts's svgToPngDataUri, same pattern as the
// PDF exports use for the full candlestick charts.

const WIDTH = 1080;
const CARD_HEIGHT = 220;
const HEADER_HEIGHT = 140;
const PADDING = 32;

const COLORS = {
  background: "#0a0a0c",
  border: "#232328",
  foreground: "#f4f4f5",
  mutedForeground: "#9a9aa4",
  positive: "#22c55e",
  negative: "#ef4444",
  accent: "#3b82f6",
};

export type ShadowlistStoryEntry = {
  ticker: string;
  taken: boolean;
  close: number | null;
  dayMovePct: number | null;
  fiveDayMovePct: number | null;
  sparkline: number[];
};

function fmtPct(value: number | null): string {
  if (value === null) return "n/v";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function pctColor(value: number | null): string {
  if (value === null) return COLORS.mutedForeground;
  return value >= 0 ? COLORS.positive : COLORS.negative;
}

function renderSparkline(values: number[], x: number, y: number, width: number, height: number): string {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((v, i) => {
      const px = x + (i / (values.length - 1)) * width;
      const py = y + height - ((v - min) / range) * height;
      return `${px.toFixed(1)},${py.toFixed(1)}`;
    })
    .join(" ");
  const lastUp = values[values.length - 1] >= values[0];
  return `<polyline points="${points}" fill="none" stroke="${lastUp ? COLORS.positive : COLORS.negative}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" />`;
}

export function renderShadowlistStorySvg(dateLabel: string, entries: ShadowlistStoryEntry[]): string {
  const height = HEADER_HEIGHT + entries.length * CARD_HEIGHT + PADDING;

  const cards = entries
    .map((entry, i) => {
      const cardY = HEADER_HEIGHT + i * CARD_HEIGHT;
      const badgeColor = entry.taken ? COLORS.positive : COLORS.mutedForeground;
      const badgeLabel = entry.taken ? "GENOMMEN" : "NICHT GENOMMEN";
      return `
        <rect x="${PADDING}" y="${cardY}" width="${WIDTH - PADDING * 2}" height="${CARD_HEIGHT - 16}" rx="16" fill="none" stroke="${COLORS.border}" stroke-width="2" />
        <text x="${PADDING + 24}" y="${cardY + 56}" fill="${COLORS.foreground}" font-size="44" font-weight="700">${entry.ticker}</text>
        <rect x="${WIDTH - PADDING - 260}" y="${cardY + 24}" width="240" height="40" rx="20" fill="none" stroke="${badgeColor}" stroke-width="2" />
        <text x="${WIDTH - PADDING - 140}" y="${cardY + 51}" fill="${badgeColor}" font-size="18" font-weight="600" text-anchor="middle">${badgeLabel}</text>
        <text x="${PADDING + 24}" y="${cardY + 100}" fill="${COLORS.mutedForeground}" font-size="22">Close</text>
        <text x="${PADDING + 140}" y="${cardY + 100}" fill="${COLORS.foreground}" font-size="22" font-weight="600">${entry.close?.toFixed(2) ?? "n/v"}</text>
        <text x="${PADDING + 24}" y="${cardY + 132}" fill="${COLORS.mutedForeground}" font-size="22">Tag</text>
        <text x="${PADDING + 140}" y="${cardY + 132}" fill="${pctColor(entry.dayMovePct)}" font-size="22" font-weight="600">${fmtPct(entry.dayMovePct)}</text>
        <text x="${PADDING + 24}" y="${cardY + 164}" fill="${COLORS.mutedForeground}" font-size="22">5 Tage</text>
        <text x="${PADDING + 140}" y="${cardY + 164}" fill="${pctColor(entry.fiveDayMovePct)}" font-size="22" font-weight="600">${fmtPct(entry.fiveDayMovePct)}</text>
        ${renderSparkline(entry.sparkline, WIDTH - PADDING - 300, cardY + 84, 260, 90)}
      `;
    })
    .join("");

  return `<svg width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${WIDTH}" height="${height}" fill="${COLORS.background}" />
    <text x="${PADDING}" y="60" fill="${COLORS.foreground}" font-size="40" font-weight="700">Shadowlist</text>
    <text x="${PADDING}" y="100" fill="${COLORS.mutedForeground}" font-size="26">${dateLabel}</text>
    ${cards}
  </svg>`;
}
