import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { CryptoTradeDetail } from "@/components/crypto/trade-detail";
import { getCryptoTrade } from "@/lib/data/crypto-trades";

export const dynamic = "force-dynamic";

export default async function CryptoTradeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getCryptoTrade(id);

  if (!result.data) notFound();

  const trade = result.data;

  return (
    <div className="space-y-6">
      <Link href="/crypto" className="text-xs text-muted-foreground hover:text-foreground">
        ← Alle Crypto-Trades
      </Link>
      <PageHeader title={`${trade.coin} — ${trade.trade_date}`} description={`${trade.direction} · ${trade.product}`} />
      <CryptoTradeDetail trade={trade} />
    </div>
  );
}
