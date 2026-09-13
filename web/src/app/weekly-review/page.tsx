import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { WeeklyReviewForm } from "@/components/weekly-review/weekly-review-form";
import { getWeeklyReviewData, getWeeklyTickerSuggestions } from "@/lib/data/weekly-review";
import { getCurrentTradeDateET, getTradingWeekBounds, isValidTradeDate, shiftTradingWeek } from "@/lib/trade-date";

export const dynamic = "force-dynamic";

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

  const [dataResult, tickerSuggestions] = await Promise.all([
    getWeeklyReviewData(weekStart, weekEnd),
    getWeeklyTickerSuggestions(),
  ]);

  if (dataResult.error || !dataResult.data) {
    return (
      <div>
        <PageHeader title="Weekly Review" description="Was ausschließlich in deinem Kopf existiert — keine Kennzahlen, keine Auswertung." />
        {weekNav}
        <p className="rounded-md border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-negative">
          {dataResult.error}
        </p>
      </div>
    );
  }

  const { review, trades, missed, demons } = dataResult.data;

  return (
    <div className="space-y-6">
      <PageHeader title="Weekly Review" description="Was ausschließlich in deinem Kopf existiert — keine Kennzahlen, keine Auswertung." />
      {weekNav}
      <WeeklyReviewForm
        review={review}
        trades={trades}
        missed={missed}
        demons={demons}
        tickerSuggestions={tickerSuggestions}
      />
    </div>
  );
}
