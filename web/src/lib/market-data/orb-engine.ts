import type { OhlcBar } from "./provider";

export type OrbShadowResult = {
  orh: number;
  orl: number;
  triggerTimestamp: string | null;
  entryPrice: number | null;
  stopPrice: number;
  exitTimestamp: string | null;
  exitPrice: number | null;
  exitReason: "stopped" | "rth_close" | null;
  modeledR: number | null;
  mfeR: number | null;
  maeR: number | null;
  rthCloseR: number | null;
  sameBarAmbiguous: boolean;
};

const OPENING_RANGE_MINUTES_BY_ORB = { 5: 5, 15: 15, 30: 30 } as const;
const SESSION_OPEN_MINUTES_FROM_MIDNIGHT_ET = 9 * 60 + 30; // 09:30 ET

const ET_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function minutesSinceOpenET(bar: OhlcBar): number {
  const parts = ET_TIME_FORMATTER.formatToParts(new Date(bar.timestamp));
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute - SESSION_OPEN_MINUTES_FROM_MIDNIGHT_ET;
}

/**
 * Computes a single ORB (5/15/30) shadow model result from a day's RTH
 * intraday bars, per LEGACY_JOURNAL_OS_V7_4_3_REFERENCE.md §6.2: strict
 * trigger (high > ORH) on the first eligible bar after the opening range
 * closes; entry = max(ORH, trigger bar open); stop = ORL; exit at stop
 * or RTH close, whichever comes first.
 *
 * Pure function, no I/O — fully unit-testable with synthetic bars ahead
 * of any real Massive integration. `bars` must be ascending-by-timestamp
 * RTH-only (09:30-16:00 ET) bars for a single ticker/trade_date.
 */
export function computeOrbShadowResult(
  bars: OhlcBar[],
  params: { orbMinutes: 5 | 15 | 30 }
): OrbShadowResult | null {
  if (bars.length === 0) return null;

  const orRangeMinutes = OPENING_RANGE_MINUTES_BY_ORB[params.orbMinutes];

  const openingBars = bars.filter((b) => {
    const m = minutesSinceOpenET(b);
    return m >= 0 && m < orRangeMinutes;
  });

  if (openingBars.length === 0) return null;

  const orh = Math.max(...openingBars.map((b) => b.high));
  const orl = Math.min(...openingBars.map((b) => b.low));

  const postOpeningBars = bars.filter((b) => minutesSinceOpenET(b) >= orRangeMinutes);

  const triggerBar = postOpeningBars.find((b) => b.high > orh) ?? null;

  if (!triggerBar) {
    return {
      orh,
      orl,
      triggerTimestamp: null,
      entryPrice: null,
      stopPrice: orl,
      exitTimestamp: null,
      exitPrice: null,
      exitReason: null,
      modeledR: null,
      mfeR: null,
      maeR: null,
      rthCloseR: null,
      sameBarAmbiguous: false,
    };
  }

  const entryPrice = Math.max(orh, triggerBar.open);
  const stopPrice = orl;
  const riskPerShare = entryPrice - stopPrice;

  const barsFromEntry = postOpeningBars.filter((b) => b.timestamp >= triggerBar.timestamp);

  // Same-bar ambiguity: the trigger bar's own low already reached the
  // stop, so OHLC data alone can't say whether the trigger or the stop
  // came first within that bar.
  const sameBarAmbiguous = triggerBar.low <= stopPrice;

  const stopHitBar = barsFromEntry.find((b) => b.low <= stopPrice) ?? null;
  const lastBar = bars[bars.length - 1];

  const exitTimestamp = stopHitBar ? stopHitBar.timestamp : lastBar.timestamp;
  const exitPrice = stopHitBar ? stopPrice : lastBar.close;
  const exitReason: OrbShadowResult["exitReason"] = stopHitBar ? "stopped" : "rth_close";

  const mfe = Math.max(...barsFromEntry.map((b) => b.high)) - entryPrice;
  const mae = entryPrice - Math.min(...barsFromEntry.map((b) => b.low));

  const toR = (priceDelta: number): number | null => (riskPerShare > 0 ? priceDelta / riskPerShare : null);

  return {
    orh,
    orl,
    triggerTimestamp: triggerBar.timestamp,
    entryPrice,
    stopPrice,
    exitTimestamp,
    exitPrice,
    exitReason,
    modeledR: toR(exitPrice - entryPrice),
    mfeR: toR(mfe),
    maeR: toR(-mae),
    rthCloseR: toR(lastBar.close - entryPrice),
    sameBarAmbiguous,
  };
}
