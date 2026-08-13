import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { DailyReviewForm } from "@/components/daily-review/daily-review-form";
import { getDailyReviewContext } from "@/lib/data/daily-review";
import { getCurrentTradeDateET, isValidTradeDate, shiftTradeDate } from "@/lib/trade-date";
import { saveDailyReviewAction } from "./actions";

export const dynamic = "force-dynamic";

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

  const contextResult = await getDailyReviewContext(tradeDate);

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
  const boundAction = saveDailyReviewAction.bind(null, tradeDate);

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

      <DailyReviewForm action={boundAction} tradeDate={tradeDate} review={review} suggestedTickers={suggestedTickers} />
    </div>
  );
}
