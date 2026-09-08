import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { DailyReviewForm } from "@/components/daily-review/daily-review-form";
import { getDailyReviewData, getFieldSuggestions } from "@/lib/data/daily-review";
import { getCurrentTradeDateET, isValidTradeDate, shiftTradeDate } from "@/lib/trade-date";

// Always reflects the live state of the selected date's review — a
// pure capture tool, no draft/final distinction, never a build-time snapshot.
export const dynamic = "force-dynamic";

export default async function DailyReviewPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams;
  const today = getCurrentTradeDateET();
  const tradeDate = date && isValidTradeDate(date) ? date : today;

  const dateNav = (
    <div className="mb-4 flex items-center justify-between text-sm">
      <Link href={`/daily-review?date=${shiftTradeDate(tradeDate, -1)}`} className="text-muted-foreground hover:text-foreground">
        ← Vorheriger Tag
      </Link>
      <span className="text-foreground">{tradeDate}</span>
      {tradeDate !== today ? (
        <Link href="/daily-review" className="text-muted-foreground hover:text-foreground">
          Heute →
        </Link>
      ) : (
        <Link href={`/daily-review?date=${shiftTradeDate(tradeDate, 1)}`} className="text-muted-foreground hover:text-foreground">
          Nächster Tag →
        </Link>
      )}
    </div>
  );

  const [dataResult, setupSuggestions, triggerSuggestions, stopLogicSuggestions] = await Promise.all([
    getDailyReviewData(tradeDate),
    getFieldSuggestions("setup"),
    getFieldSuggestions("trigger_tactic"),
    getFieldSuggestions("stop_logic"),
  ]);

  if (dataResult.error || !dataResult.data) {
    return (
      <div>
        <PageHeader title="Daily Review" description={`Trade-Datum: ${tradeDate}`} />
        {dateNav}
        <p className="rounded-md border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-negative">
          {dataResult.error ?? "Daily Review konnte nicht geladen werden."}
        </p>
      </div>
    );
  }

  const { review, watchlistToday, watchlistNext, trades, guardrails, priorSessionPlanHint } = dataResult.data;

  return (
    <div>
      <PageHeader
        title="Daily Review"
        description="Speichert Inputs, rendert Charts, erzeugt PDFs. Kein Feld ist Pflicht außer dem Datum."
      />
      {dateNav}
      <DailyReviewForm
        key={tradeDate}
        tradeDate={tradeDate}
        review={review}
        watchlistToday={watchlistToday}
        watchlistNext={watchlistNext}
        trades={trades}
        guardrails={guardrails}
        priorSessionPlanHint={priorSessionPlanHint}
        tradeFieldSuggestions={{ setup: setupSuggestions, trigger_tactic: triggerSuggestions, stop_logic: stopLogicSuggestions }}
      />
    </div>
  );
}
