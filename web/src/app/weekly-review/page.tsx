import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { WeeklyAggregationDisplay } from "@/components/weekly-review/aggregation-display";
import { WeeklyReviewForm } from "@/components/weekly-review/weekly-review-form";
import { FinalizeWeeklyReviewButton } from "@/components/weekly-review/finalize-weekly-review-button";
import { getWeeklyReview } from "@/lib/data/weekly-review";
import { getWeeklyReportSnapshot } from "@/lib/data/weekly-report-snapshot";
import { aggregateWeek } from "@/lib/weekly-review/aggregate";
import { getCurrentTradeDateET, getTradingWeekBounds, isValidTradeDate, shiftTradingWeek } from "@/lib/trade-date";
import { finalizeWeeklyReviewAction, saveWeeklyReviewAction } from "./actions";

export const dynamic = "force-dynamic";
// Aggregation touches several tables across the whole week plus two
// Massive daily-chart fetches — generous but bounded budget.
export const maxDuration = 60;

export default async function WeeklyReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const anchorDate = week && isValidTradeDate(week) ? week : getCurrentTradeDateET();
  const { weekStart, weekEnd } = getTradingWeekBounds(anchorDate);

  const weekNav = (
    <div className="mb-4 flex items-center justify-between text-sm">
      <Link
        href={`/weekly-review?week=${shiftTradingWeek(weekStart, -1)}`}
        className="text-muted-foreground hover:text-foreground"
      >
        ← Vorherige Woche
      </Link>
      <span className="text-foreground">
        {weekStart} – {weekEnd}
      </span>
      <Link
        href={`/weekly-review?week=${shiftTradingWeek(weekStart, 1)}`}
        className="text-muted-foreground hover:text-foreground"
      >
        Nächste Woche →
      </Link>
    </div>
  );

  const [reviewResult, snapshotResult] = await Promise.all([getWeeklyReview(weekStart), getWeeklyReportSnapshot(weekStart)]);

  if (reviewResult.error) {
    return (
      <div>
        <PageHeader title="Weekly Review" description="Aggregation über die Daily Reviews der Woche." />
        {weekNav}
        <p className="rounded-md border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-negative">
          {reviewResult.error}
        </p>
      </div>
    );
  }

  const isFinalized = snapshotResult.data !== null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Weekly Review"
        description="Automatische Aggregation über Daily Reviews, Broker-, Campaign- und Shadowlist-Daten — Selection, Execution und Management getrennt."
      />
      {weekNav}

      {isFinalized ? (
        <div className="flex items-center justify-between rounded-md border border-positive/40 bg-positive/10 px-3 py-2 text-sm">
          <span className="text-positive">FINAL — dieser Weekly Review wurde abgeschlossen und ist nicht mehr editierbar.</span>
          <Link href={`/reports/weekly/${weekStart}`} className="font-medium text-accent hover:underline">
            Report öffnen →
          </Link>
        </div>
      ) : (
        <LiveDraftView weekStart={weekStart} weekEnd={weekEnd} review={reviewResult.data} />
      )}
    </div>
  );
}

async function LiveDraftView({
  weekStart,
  weekEnd,
  review,
}: {
  weekStart: string;
  weekEnd: string;
  review: Awaited<ReturnType<typeof getWeeklyReview>>["data"];
}) {
  const aggregation = await aggregateWeek(weekStart, weekEnd);
  const boundSaveAction = saveWeeklyReviewAction.bind(null, weekStart, weekEnd);
  const boundFinalizeAction = finalizeWeeklyReviewAction.bind(null, weekStart);

  return (
    <>
      <WeeklyAggregationDisplay aggregation={aggregation} />
      <WeeklyReviewForm action={boundSaveAction} weekStart={weekStart} review={review} />
      {review ? <FinalizeWeeklyReviewButton action={boundFinalizeAction} /> : null}
    </>
  );
}
