import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { listTrades } from "@/lib/data/trades";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";

// Trade data changes frequently and must never be served stale from a
// build-time snapshot, so this route always renders per-request.
export const dynamic = "force-dynamic";

export default async function TradesPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort } = await searchParams;
  const sortDirection = sort === "asc" ? "asc" : "desc";

  const result = await listTrades({ sortDirection });

  return (
    <div>
      <PageHeader title="Trades" description="Trades erfassen, ansehen und bearbeiten." />

      <div className="mb-4 flex items-center justify-between">
        <Link
          href={`/trades?sort=${sortDirection === "asc" ? "desc" : "asc"}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Opened At {sortDirection === "asc" ? "↑" : "↓"} sortieren
        </Link>
        <Link
          href="/trades/new"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
        >
          + Neuer Trade
        </Link>
      </div>

      {!result.data ? (
        <p className="rounded-md border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-negative">
          {result.error}
        </p>
      ) : result.data.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-surface text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Symbol</th>
                <th className="px-4 py-3">Richtung</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Strategy</th>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">Opened</th>
                <th className="px-4 py-3">Closed</th>
                <th className="px-4 py-3 text-right">Init. Risiko</th>
                <th className="px-4 py-3 text-right">R-Multiple</th>
                <th className="px-4 py-3 text-right">Net P&amp;L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {result.data.map((trade) => (
                <tr key={trade.id} className="hover:bg-surface-hover">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/trades/${trade.id}`} className="hover:text-accent">
                      {trade.symbol}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={trade.direction === "long" ? "text-positive" : "text-negative"}>
                      {trade.direction === "long" ? "Long" : "Short"}
                    </span>
                  </td>
                  <td className="px-4 py-3 capitalize text-muted-foreground">{trade.status}</td>
                  <td className="px-4 py-3 text-muted-foreground">{trade.strategy?.name ?? "–"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{trade.account?.name ?? "–"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDateTime(trade.opened_at)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDateTime(trade.closed_at)}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {formatCurrency(trade.initial_risk_amount)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {trade.metrics?.r_multiple != null ? (
                      <span className={trade.metrics.r_multiple >= 0 ? "text-positive" : "text-negative"}>
                        {formatNumber(trade.metrics.r_multiple)}R
                      </span>
                    ) : (
                      <span className="text-muted-foreground">–</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {trade.metrics?.net_pnl != null ? (
                      <span className={trade.metrics.net_pnl >= 0 ? "text-positive" : "text-negative"}>
                        {formatCurrency(trade.metrics.net_pnl)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">–</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          Noch keine Trades erfasst.{" "}
          <Link href="/trades/new" className="text-accent hover:underline">
            Ersten Trade anlegen
          </Link>
          .
        </div>
      )}
    </div>
  );
}
