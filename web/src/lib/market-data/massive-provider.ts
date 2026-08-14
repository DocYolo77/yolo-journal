import type { IndexExtensionSnapshot, IndicatorSnapshot, MarketDataProvider, OhlcBar, OhlcInterval } from "./provider";
import { getAggregateBars, getEma, getSma, getSnapshot, type MassiveAggBar } from "./massive-client";
import { computeAtr14, computeAtrPctExtensionFromMa } from "./indicators";
import { shiftTradeDate } from "@/lib/trade-date";

const INTERVAL_TO_MASSIVE: Record<OhlcInterval, { multiplier: number; timespan: "minute" | "day" }> = {
  "1m": { multiplier: 1, timespan: "minute" },
  "5m": { multiplier: 5, timespan: "minute" },
  "15m": { multiplier: 15, timespan: "minute" },
  "30m": { multiplier: 30, timespan: "minute" },
  "1d": { multiplier: 1, timespan: "day" },
};

function toOhlcBar(bar: MassiveAggBar): OhlcBar {
  return {
    timestamp: new Date(bar.t).toISOString(),
    open: bar.o,
    high: bar.h,
    low: bar.l,
    close: bar.c,
    volume: bar.v,
  };
}

export class MassiveMarketDataProvider implements MarketDataProvider {
  readonly name = "massive";

  async getOhlcBars(params: { ticker: string; tradeDate: string; interval: OhlcInterval }): Promise<OhlcBar[]> {
    const { multiplier, timespan } = INTERVAL_TO_MASSIVE[params.interval];
    const bars = await getAggregateBars({
      ticker: params.ticker,
      multiplier,
      timespan,
      from: params.tradeDate,
      to: params.tradeDate,
      sort: "asc",
    });
    return bars.map(toOhlcBar);
  }

  async getPriorSessionIndicators(params: { ticker: string; tradeDate: string }): Promise<IndicatorSnapshot | null> {
    // D-1 only, no future/same-day leakage: cap every query at the day
    // before tradeDate.
    const priorDate = shiftTradeDate(params.tradeDate, -1);

    const [dailyBars, ema10, ema20, sma50, sma100, sma200] = await Promise.all([
      // enough trailing bars for a 14-period ATR (needs 15).
      getAggregateBars({
        ticker: params.ticker,
        multiplier: 1,
        timespan: "day",
        from: shiftTradeDate(priorDate, -40),
        to: priorDate,
        sort: "asc",
        limit: 30,
      }),
      getEma({ ticker: params.ticker, window: 10, timespan: "day", timestamp: priorDate, limit: 1 }),
      getEma({ ticker: params.ticker, window: 20, timespan: "day", timestamp: priorDate, limit: 1 }),
      getSma({ ticker: params.ticker, window: 50, timespan: "day", timestamp: priorDate, limit: 1 }),
      getSma({ ticker: params.ticker, window: 100, timespan: "day", timestamp: priorDate, limit: 1 }),
      getSma({ ticker: params.ticker, window: 200, timespan: "day", timestamp: priorDate, limit: 1 }),
    ]);

    if (dailyBars.length === 0) return null;

    const priorClose = dailyBars[dailyBars.length - 1].c; // ascending order, so last = most recent (priorDate)
    const atrBars = dailyBars.map((b) => ({
      timestamp: new Date(b.t).toISOString(),
      open: b.o,
      high: b.h,
      low: b.l,
      close: b.c,
    }));

    return {
      close: priorClose,
      ema10: ema10[0]?.value ?? null,
      ema20: ema20[0]?.value ?? null,
      sma50: sma50[0]?.value ?? null,
      sma100: sma100[0]?.value ?? null,
      sma200: sma200[0]?.value ?? null,
      atr14: computeAtr14(atrBars),
    };
  }

  async getIndexSnapshot(params: { tradeDate: string }): Promise<Record<string, unknown>> {
    const [qqq, spy] = await Promise.all([getSnapshot("QQQ"), getSnapshot("SPY")]);
    return { tradeDate: params.tradeDate, qqq, spy };
  }

  async getIndexExtension(params: { ticker: "QQQ" | "SPY"; tradeDate: string }): Promise<IndexExtensionSnapshot> {
    const [snapshot, indicators] = await Promise.all([
      getSnapshot(params.ticker),
      this.getPriorSessionIndicators({ ticker: params.ticker, tradeDate: params.tradeDate }),
    ]);

    // Prefer the live last trade; fall back to today's session close, then
    // the prior session's close (D-1 indicators) if neither is available
    // yet (e.g. called before the market has traded at all today).
    const price = snapshot?.lastTrade?.p ?? snapshot?.day?.c ?? indicators?.close ?? null;
    const sma50 = indicators?.sma50 ?? null;
    const atr14 = indicators?.atr14 ?? null;

    const atrExtensionMultiple =
      price !== null && sma50 !== null && atr14 !== null
        ? computeAtrPctExtensionFromMa({ price, movingAverage: sma50, atr: atr14 })
        : null;

    return { price, sma50, atr14, atrExtensionMultiple };
  }

  async getDailyBarsRange(params: { ticker: string; from: string; to: string }): Promise<OhlcBar[]> {
    const bars = await getAggregateBars({
      ticker: params.ticker,
      multiplier: 1,
      timespan: "day",
      from: params.from,
      to: params.to,
      sort: "asc",
      limit: 50000,
    });
    return bars.map(toOhlcBar);
  }
}
