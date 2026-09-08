import { getDailyChartSeries } from "@/lib/market-data/chart-data";
import { svgToPngDataUri } from "@/lib/reports/rasterize-svg";
import { renderShadowlistStorySvg, type ShadowlistStoryEntry } from "@/lib/charts/shadowlist-story";
import type { DailyReviewWatchlistRow } from "@/lib/supabase/types";

// v2 Shadowlist (§3.3) — decoupled from the abolished Commitment.
// Ticker source is the review's own daily_review_watchlist
// (scope='today'), which already carries taken/note — there is no
// separate shadowlist table. This file only adds the chart-derived
// read model (close/day-move/5-day-move) and the "Export als PNG im
// Story-Format" feature on top of it.

export type ShadowlistChartStats = {
  close: number | null;
  dayMovePct: number | null;
  fiveDayMovePct: number | null;
  sparkline: number[];
};

async function getChartStatsForTicker(ticker: string, tradeDate: string): Promise<ShadowlistChartStats> {
  try {
    const series = await getDailyChartSeries(ticker, tradeDate);
    if (series.length === 0) {
      return { close: null, dayMovePct: null, fiveDayMovePct: null, sparkline: [] };
    }
    const last = series[series.length - 1];
    const close = last.close;
    const dayMovePct = last.open ? ((last.close - last.open) / last.open) * 100 : null;
    const fiveBarsAgo = series.length > 5 ? series[series.length - 6] : null;
    const fiveDayMovePct = fiveBarsAgo && fiveBarsAgo.close ? ((last.close - fiveBarsAgo.close) / fiveBarsAgo.close) * 100 : null;
    const sparkline = series.slice(-15).map((p) => p.close);
    return { close, dayMovePct, fiveDayMovePct, sparkline };
  } catch (e) {
    console.error(`getChartStatsForTicker(${ticker}) failed`, e);
    return { close: null, dayMovePct: null, fiveDayMovePct: null, sparkline: [] };
  }
}

export type ShadowlistEntry = DailyReviewWatchlistRow & ShadowlistChartStats;

/** Watchlist rows (scope='today') enriched with chart-derived stats — the read model for the Shadowlist page. */
export async function getShadowlistEntries(
  tradeDate: string,
  watchlistToday: DailyReviewWatchlistRow[]
): Promise<ShadowlistEntry[]> {
  return Promise.all(
    watchlistToday.map(async (item) => ({
      ...item,
      ...(await getChartStatsForTicker(item.ticker, tradeDate)),
    }))
  );
}

function formatGermanDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}.${month}.${year}`;
}

/** §3.3 — "Export als PNG im Story-Format bleibt." Returns a data: URI ready for direct download. */
export async function buildShadowlistStoryPng(
  tradeDate: string,
  entries: ShadowlistEntry[]
): Promise<{ data: string; error: null } | { data: null; error: string }> {
  try {
    if (entries.length === 0) {
      return { data: null, error: "Keine Watchlist-Ticker für dieses Datum." };
    }
    const storyEntries: ShadowlistStoryEntry[] = entries.map((e) => ({
      ticker: e.ticker,
      taken: e.taken,
      close: e.close,
      dayMovePct: e.dayMovePct,
      fiveDayMovePct: e.fiveDayMovePct,
      sparkline: e.sparkline,
    }));
    const svg = renderShadowlistStorySvg(formatGermanDate(tradeDate), storyEntries);
    const dataUri = await svgToPngDataUri(svg, 1080);
    return { data: dataUri, error: null };
  } catch (e) {
    console.error("buildShadowlistStoryPng failed", e);
    return { data: null, error: "PNG-Export fehlgeschlagen." };
  }
}
