import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { ShadowlistView } from "@/components/shadowlist/shadowlist-view";
import { getDailyReviewData } from "@/lib/data/daily-review";
import { getShadowlistEntries } from "@/lib/data/shadowlist";
import { getCurrentTradeDateET, isValidTradeDate, shiftTradeDate } from "@/lib/trade-date";

export const dynamic = "force-dynamic";

export default async function ShadowlistPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams;
  const today = getCurrentTradeDateET();
  const tradeDate = date && isValidTradeDate(date) ? date : today;

  const dateNav = (
    <div className="mb-4 flex items-center justify-between text-sm">
      <Link href={`/shadowlist?date=${shiftTradeDate(tradeDate, -1)}`} className="text-muted-foreground hover:text-foreground">
        ← Vorheriger Tag
      </Link>
      <span className="text-foreground">{tradeDate}</span>
      {tradeDate !== today ? (
        <Link href="/shadowlist" className="text-muted-foreground hover:text-foreground">
          Heute →
        </Link>
      ) : (
        <Link href={`/shadowlist?date=${shiftTradeDate(tradeDate, 1)}`} className="text-muted-foreground hover:text-foreground">
          Nächster Tag →
        </Link>
      )}
    </div>
  );

  const dataResult = await getDailyReviewData(tradeDate);

  if (dataResult.error || !dataResult.data) {
    return (
      <div>
        <PageHeader title="Shadowlist" description={`Trade-Datum: ${tradeDate}`} />
        {dateNav}
        <p className="rounded-md border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-negative">
          {dataResult.error ?? "Shadowlist konnte nicht geladen werden."}
        </p>
      </div>
    );
  }

  const entries = await getShadowlistEntries(tradeDate, dataResult.data.watchlist);

  return (
    <div>
      <PageHeader
        title="Shadowlist"
        description="Ticker aus der heutigen Watchlist des Daily Reviews — genommen oder nicht, mit optionaler Notiz."
      />
      {dateNav}
      <ShadowlistView key={tradeDate} tradeDate={tradeDate} entries={entries} />
    </div>
  );
}
