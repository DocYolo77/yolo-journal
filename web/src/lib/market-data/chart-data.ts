import { MassiveMarketDataProvider } from "./massive-provider";
import { computeEmaSeries, computeSmaSeries } from "./series-indicators";
import { computeOrbShadowResult } from "./orb-engine";
import { shiftTradeDate } from "@/lib/trade-date";
import type { ChartSeriesPoint, IntradayBarPoint, OrbLevel } from "@/lib/supabase/types";

// Ample warmup so SMA200 is already valid at the start of the visible
// display window, not just by the end of it — computed over the full
// range, then the array is sliced down to DAILY_DISPLAY_DAYS for what
// actually ships in the report.
const DAILY_WARMUP_CALENDAR_DAYS = 400;
const DAILY_DISPLAY_DAYS = 120;

function toDateOnly(isoTimestamp: string): string {
  return isoTimestamp.slice(0, 10);
}

/**
 * Daily chart series for the Daily Report's daily chart — OHLC plus
 * EMA10/EMA20/SMA50/SMA100/SMA200, all computed from the same fetched
 * bars (see series-indicators.ts). `to` must be a date that has already
 * happened (the Daily Report is always for a past trade_date) — no
 * future leakage by construction, since Massive itself has no data past
 * "now" anyway.
 */
export async function getDailyChartSeries(ticker: string, tradeDate: string): Promise<ChartSeriesPoint[]> {
  const provider = new MassiveMarketDataProvider();
  const from = shiftTradeDate(tradeDate, -DAILY_WARMUP_CALENDAR_DAYS);
  const bars = await provider.getDailyBarsRange({ ticker, from, to: tradeDate });

  if (bars.length === 0) return [];

  const closesOnly = bars.map((b) => ({ close: b.close }));
  const ema10 = computeEmaSeries(closesOnly, 10);
  const ema20 = computeEmaSeries(closesOnly, 20);
  const sma50 = computeSmaSeries(closesOnly, 50);
  const sma100 = computeSmaSeries(closesOnly, 100);
  const sma200 = computeSmaSeries(closesOnly, 200);

  const full: ChartSeriesPoint[] = bars.map((bar, i) => ({
    date: toDateOnly(bar.timestamp),
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
    ema10: ema10[i],
    ema20: ema20[i],
    sma50: sma50[i],
    sma100: sma100[i],
    sma200: sma200[i],
  }));

  return full.slice(-DAILY_DISPLAY_DAYS);
}

const RTH_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

// DST-safe by construction: Intl.DateTimeFormat resolves the instant
// against the America/New_York zone's actual current offset, never a
// hardcoded UTC delta.
function isWithinRth(isoTimestamp: string): boolean {
  const parts = RTH_TIME_FORMATTER.formatToParts(new Date(isoTimestamp));
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const minutesSinceMidnight = hour * 60 + minute;
  return minutesSinceMidnight >= 9 * 60 + 30 && minutesSinceMidnight < 16 * 60;
}

/** 5-minute intraday bars for trade_date, filtered to RTH 09:30-16:00 America/New_York. */
export async function getIntradayChartSeries(ticker: string, tradeDate: string): Promise<IntradayBarPoint[]> {
  const provider = new MassiveMarketDataProvider();
  const bars = await provider.getOhlcBars({ ticker, tradeDate, interval: "5m" });
  return bars
    .filter((b) => isWithinRth(b.timestamp))
    .map((b) => ({
      timestamp: b.timestamp,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume: b.volume,
    }));
}

// MACD(6,20,9) needs the slow EMA(20) then the signal EMA(9) seeded —
// 28 bars — before it's valid; kept generously above that so the line
// is stable, not barely-seeded, right at 09:30.
const INTRADAY_WARMUP_MIN_BARS = 60;
// Calendar (not trading) days to search backward for those bars — wide
// enough to cross weekends and multi-day holiday runs. Massive simply
// returns no bars for closed days, so this needs no explicit trading
// calendar: whatever real RTH bars exist in the window are used, and
// the most recent INTRADAY_WARMUP_MIN_BARS of them are kept.
const INTRADAY_WARMUP_LOOKBACK_CALENDAR_DAYS = 12;

/**
 * Real prior-session 5-minute RTH bars strictly before `tradeDate`, used
 * only to seed the intraday chart's MACD before the first visible 09:30
 * bar — never displayed themselves (see renderIntradayChartSvg). Bug fix
 * for MACD showing null/flat for the first ~2h20m of every session: it
 * was being computed from a bar array that started at 09:30 with zero
 * prior history to seed EMA(20)/EMA(9) from.
 */
export async function getIntradayWarmupBars(ticker: string, tradeDate: string): Promise<IntradayBarPoint[]> {
  const provider = new MassiveMarketDataProvider();
  const from = shiftTradeDate(tradeDate, -INTRADAY_WARMUP_LOOKBACK_CALENDAR_DAYS);
  const to = shiftTradeDate(tradeDate, -1);
  const bars = await provider.getIntradayBarsRange({ ticker, from, to, interval: "5m" });
  const rthOnly = bars
    .filter((b) => isWithinRth(b.timestamp))
    .map((b) => ({
      timestamp: b.timestamp,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume: b.volume,
    }));
  return rthOnly.slice(-INTRADAY_WARMUP_MIN_BARS);
}

/**
 * ORB levels actually derivable from the real intraday bars — reuses
 * the same computeOrbShadowResult as the Shadowlist's shadow model, so
 * "valide ableitbar" means exactly the same thing here as it does
 * there. Never returns a fabricated level: an orbMinutes window with no
 * opening bars in the fetched data is simply omitted.
 */
export function computeOrbLevelsFromIntraday(bars: IntradayBarPoint[]): OrbLevel[] {
  const levels: OrbLevel[] = [];
  for (const orbMinutes of [5, 15, 30] as const) {
    const result = computeOrbShadowResult(bars, { orbMinutes });
    if (result) {
      levels.push({ orb_minutes: orbMinutes, orh: result.orh, orl: result.orl });
    }
  }
  return levels;
}
