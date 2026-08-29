import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { DailyReviewForm } from "@/components/daily-review/daily-review-form";
import { FinalizeReviewButton } from "@/components/daily-review/finalize-review-button";
import { getDailyReviewContext } from "@/lib/data/daily-review";
import {
  getCampaignsForReview,
  getReportSnapshot,
  getTickerChartDataForReview,
} from "@/lib/data/report-snapshot";
import { getDailyPnlSnapshotForDate, getPortfolioSnapshotForDate } from "@/lib/data/portfolio";
import { getCurrentTradeDateET, isValidTradeDate, shiftTradeDate } from "@/lib/trade-date";
import { renderDailyChartSvg, renderIntradayChartSvg } from "@/lib/charts/svg-chart";
import type { TickerChartSvgPair } from "@/components/daily-review/daily-review-form";
import { finalizeDailyReviewAction, generateCoachingTakeAction, saveDailyReviewAction } from "./actions";

export const dynamic = "force-dynamic";
// Headroom for the "KI-Fazit generieren" Server Action (Anthropic
// Messages API call) — the platform default (10s on Hobby) can be tight
// under real network latency. Actual plan ceiling still applies; this
// just requests the maximum this route is allowed to use.
export const maxDuration = 60;

export default async function DailyReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const tradeDate = date && isValidTradeDate(date) ? date : getCurrentTradeDateET();

  const dateNav = (
    <div className="mb-4 flex items-center justify-between text-sm">
      <Link
        href={`/daily-review?date=${shiftTradeDate(tradeDate, -1)}`}
        className="text-muted-foreground hover:text-foreground"
      >
        ← Vorheriger Tag
      </Link>
      <span className="text-foreground">{tradeDate}</span>
      <Link
        href={`/daily-review?date=${shiftTradeDate(tradeDate, 1)}`}
        className="text-muted-foreground hover:text-foreground"
      >
        Nächster Tag →
      </Link>
    </div>
  );

  const [contextResult, snapshotResult, portfolioSnapshot, dailyPnlResult, campaigns] = await Promise.all([
    getDailyReviewContext(tradeDate),
    getReportSnapshot(tradeDate),
    // Date-scoped, not "whatever synced most recently globally" — a
    // backfilled past Daily Review must show that day's own EOD
    // portfolio (matches finalizeDailyReview's already-established
    // convention in lib/data/report-snapshot.ts), otherwise a position
    // already closed by that day's EOD can still show up as "open" just
    // because it happens to be in the current live account.
    getPortfolioSnapshotForDate(tradeDate),
    getDailyPnlSnapshotForDate(tradeDate),
    getCampaignsForReview(tradeDate),
  ]);

  if (!contextResult.data) {
    return (
      <div>
        <PageHeader title="Daily Review" description="Daily Review & Coaching Journal" />
        {dateNav}
        <p className="rounded-md border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-negative">
          {contextResult.error}
        </p>
      </div>
    );
  }

  const { review, commitment } = contextResult.data;
  const isReconstructed = review?.is_reconstructed ?? commitment === null;
  const suggestedTickers = commitment?.watchlist.map((w) => w.ticker) ?? [];
  const boundSaveAction = saveDailyReviewAction.bind(null, tradeDate);
  const boundFinalizeAction = finalizeDailyReviewAction.bind(null, tradeDate);
  const boundGenerateCoachTakeAction = generateCoachingTakeAction.bind(null, tradeDate);

  const isFinalized = snapshotResult.data !== null;

  // Every ticker the user is plausibly about to review or has already
  // reviewed: already-saved ticker reviews, the committed watchlist, and
  // whatever IBKR's latest position snapshot currently holds — so a
  // chart is ready the moment a ticker becomes relevant, not only after
  // it's been manually added and saved once.
  const chartTickers = isFinalized
    ? []
    : Array.from(
        new Set([
          ...(review?.ticker_reviews.map((t) => t.ticker) ?? []),
          ...suggestedTickers,
          ...portfolioSnapshot.positions.map((p) => p.symbol),
        ])
      );

  const tickerCharts = await getTickerChartDataForReview(tradeDate, chartTickers);

  const chartSvgByTicker: Record<string, TickerChartSvgPair> = {};
  for (const chart of tickerCharts) {
    chartSvgByTicker[chart.ticker] = {
      dailySvg: renderDailyChartSvg(chart.ticker, chart.daily),
      intradaySvg: renderIntradayChartSvg(
        chart.ticker,
        chart.intraday,
        chart.orb_levels,
        chart.markers,
        chart.intraday_warmup ?? []
      ),
    };
  }

  return (
    <div>
      <PageHeader
        title="Daily Review"
        description="Review gegen den gelockten Premarket-Plan — Selection, Execution und Management getrennt bewertet."
      />
      {dateNav}

      {isReconstructed ? (
        <div className="mb-4 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent">
          Reconstructed / No locked premarket commitment available — für diesen Tag existiert kein
          gelocktes Commitment in Supabase. Dieser Review wird nachträglich rekonstruiert, nicht so
          dargestellt, als hätte ein Commitment vorgelegen.
        </div>
      ) : null}

      {isFinalized ? (
        <div className="mb-6 flex items-center justify-between rounded-md border border-positive/40 bg-positive/10 px-3 py-2 text-sm">
          <span className="text-positive">
            FINAL — dieser Review wurde abgeschlossen und ist nicht mehr editierbar.
          </span>
          <Link href={`/reports/daily/${tradeDate}`} className="font-medium text-accent hover:underline">
            Report öffnen →
          </Link>
        </div>
      ) : null}

      {isFinalized ? null : (
        <>
          {/* key={tradeDate}: DailyReviewForm seeds its guardrails/mental/
              todos/ticker_reviews state (and every defaultValue-based
              field) from `review` only once, at mount. Without a key tied
              to the date, the Prev/Next Day Links above don't remount it —
              React just re-renders the same instance with a new `review`
              prop, so all that state keeps showing the previously-viewed
              day's values instead of the newly-loaded day's. Saving in
              that state would silently overwrite the new day's Ticker
              Reviews/Mental/Verbesserungspunkte with stale data from the
              day navigated away from. */}
          <DailyReviewForm
            key={tradeDate}
            action={boundSaveAction}
            generateCoachTakeAction={boundGenerateCoachTakeAction}
            tradeDate={tradeDate}
            review={review}
            suggestedTickers={suggestedTickers}
            portfolio={portfolioSnapshot.positions}
            portfolioCapturedAt={portfolioSnapshot.capturedAt}
            portfolioSource={dailyPnlResult.data?.source ?? null}
            dailyPnlSnapshot={dailyPnlResult.data ?? null}
            campaigns={campaigns}
            chartSvgByTicker={chartSvgByTicker}
          />
          {review ? (
            <div className="mt-6">
              <FinalizeReviewButton action={boundFinalizeAction} guardrailsReviewed={review.guardrails_reviewed} />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
