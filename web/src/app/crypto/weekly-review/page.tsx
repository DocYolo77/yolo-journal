import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { CryptoWeeklyReviewForm } from "@/components/crypto/weekly-review-form";
import {
  computeCryptoWeeklyMetrics,
  getCryptoLearningsForWeek,
  getCryptoTradesForWeek,
  getCryptoWeeklyReview,
} from "@/lib/data/crypto-weekly-review";
import { getCurrentTradeDateET, getTradingWeekBounds, isValidTradeDate, shiftTradingWeek } from "@/lib/trade-date";

export const dynamic = "force-dynamic";

function formatUsd(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)} $`;
}

function formatR(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}R`;
}

export default async function CryptoWeeklyReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const anchorDate = week && isValidTradeDate(week) ? week : getCurrentTradeDateET();
  const { weekStart, weekEnd } = getTradingWeekBounds(anchorDate);

  const [tradesResult, learningsResult, reviewResult] = await Promise.all([
    getCryptoTradesForWeek(weekStart, weekEnd),
    getCryptoLearningsForWeek(weekStart, weekEnd),
    getCryptoWeeklyReview(weekStart),
  ]);

  const metrics = computeCryptoWeeklyMetrics(tradesResult.data ?? []);

  return (
    <div className="space-y-6">
      <PageHeader title="Crypto — Weekly Review" description="Bewusst deutlich kleiner als das Aktien-Review." />

      <div className="flex items-center justify-between text-sm">
        <Link href={`/crypto/weekly-review?week=${shiftTradingWeek(weekStart, -1)}`} className="text-muted-foreground hover:text-foreground">
          ← Vorherige Woche
        </Link>
        <span className="text-foreground">
          {weekStart} – {weekEnd}
        </span>
        <Link href={`/crypto/weekly-review?week=${shiftTradingWeek(weekStart, 1)}`} className="text-muted-foreground hover:text-foreground">
          Nächste Woche →
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-md border border-border bg-surface p-3 text-center">
          <p className="text-xs text-muted-foreground">Trades</p>
          <p className="text-lg font-semibold text-foreground">{metrics.tradesCount}</p>
        </div>
        <div className="rounded-md border border-border bg-surface p-3 text-center">
          <p className="text-xs text-muted-foreground">Wochen-P&amp;L $</p>
          <p className={`text-lg font-semibold ${metrics.pnlUsd > 0 ? "text-positive" : metrics.pnlUsd < 0 ? "text-negative" : "text-foreground"}`}>
            {formatUsd(metrics.pnlUsd)}
          </p>
        </div>
        <div className="rounded-md border border-border bg-surface p-3 text-center">
          <p className="text-xs text-muted-foreground">Wochen-R</p>
          <p className={`text-lg font-semibold ${metrics.pnlR > 0 ? "text-positive" : metrics.pnlR < 0 ? "text-negative" : "text-foreground"}`}>
            {formatR(metrics.pnlR)}
          </p>
        </div>
      </div>

      {tradesResult.error ? <p className="text-sm text-negative">{tradesResult.error}</p> : null}
      {reviewResult.error ? <p className="text-sm text-negative">{reviewResult.error}</p> : null}

      <CryptoWeeklyReviewForm weekStart={weekStart} weekEnd={weekEnd} review={reviewResult.data ?? null} />

      {learningsResult.data && learningsResult.data.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">Neue Learnings diese Woche</h2>
          <div className="space-y-2">
            {learningsResult.data.map((entry) => (
              <div key={entry.id} className="rounded-md border border-border bg-surface p-3 text-sm text-foreground">
                {entry.lesson}
                {entry.coin ? <span className="ml-2 text-xs text-muted-foreground">({entry.coin})</span> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
