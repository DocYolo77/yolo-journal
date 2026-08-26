import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { CryptoTradeQuickAdd } from "@/components/crypto/trade-quick-add";
import { listCryptoTrades } from "@/lib/data/crypto-trades";

export const dynamic = "force-dynamic";

function formatUsd(value: number | null): string {
  if (value == null) return "–";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)} $`;
}

function formatR(value: number | null): string {
  if (value == null) return "–";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}R`;
}

function pnlColor(value: number | null): string {
  if (value == null || value === 0) return "text-foreground";
  return value > 0 ? "text-positive" : "text-negative";
}

export default async function CryptoTradesPage() {
  const trades = await listCryptoTrades();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Crypto — Trades"
        description="Jeder Trade ist eine eigene Entity: dokumentieren, managen, abschließen, Lesson extrahieren. Kein tägliches Review, kein Aktienjournal-Umfang."
      />

      <CryptoTradeQuickAdd />

      {trades.error ? <p className="text-sm text-negative">{trades.error}</p> : null}

      <div className="space-y-2">
        {(trades.data ?? []).map((trade) => (
          <Link
            key={trade.id}
            href={`/crypto/${trade.id}`}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface p-3 transition-colors hover:bg-surface-hover"
          >
            <div className="flex items-center gap-3">
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  trade.status === "OPEN" ? "bg-accent/15 text-accent" : "bg-border text-muted-foreground"
                }`}
              >
                {trade.status === "OPEN" ? "Offen" : "Geschlossen"}
              </span>
              <span className="text-sm font-medium text-foreground">{trade.coin}</span>
              <span className="text-xs text-muted-foreground">
                {trade.direction} · {trade.product}
              </span>
              <span className="text-xs text-muted-foreground">{trade.trade_date}</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className={pnlColor(trade.result_usd)}>{formatUsd(trade.result_usd)}</span>
              <span className={pnlColor(trade.result_r)}>{formatR(trade.result_r)}</span>
            </div>
          </Link>
        ))}
        {trades.data && trades.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Crypto-Trades erfasst.</p>
        ) : null}
      </div>
    </div>
  );
}
