import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { TradeDetailView } from "@/components/trades/trade-detail-view";
import { getTradeById } from "@/lib/data/trades";
import { listActiveAccounts } from "@/lib/data/accounts";
import { listActiveStrategies } from "@/lib/data/strategies";
import { createExecutionAction, deleteExecutionAction, updateTradeAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function TradeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ executionError?: string }>;
}) {
  const { id } = await params;
  const { executionError } = await searchParams;

  const [tradeResult, accountsResult, strategiesResult] = await Promise.all([
    getTradeById(id),
    listActiveAccounts(),
    listActiveStrategies(),
  ]);

  if (tradeResult.notFound) {
    notFound();
  }

  if (!tradeResult.data) {
    return (
      <div>
        <PageHeader title="Trade" />
        <p className="rounded-md border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-negative">
          {tradeResult.error}
        </p>
      </div>
    );
  }

  const trade = tradeResult.data;
  const boundUpdateAction = updateTradeAction.bind(null, trade.id);
  const boundCreateExecutionAction = createExecutionAction.bind(null, trade.id);
  const boundDeleteExecutionAction = deleteExecutionAction.bind(null, trade.id);

  return (
    <div>
      <PageHeader
        title={trade.symbol}
        description={`${trade.direction === "long" ? "Long" : "Short"} · ${trade.status}`}
      />
      <div className="mb-4">
        <Link href="/trades" className="text-sm text-muted-foreground hover:text-foreground">
          ← Zurück zur Trade-Liste
        </Link>
      </div>
      {executionError ? (
        <p className="mb-4 rounded-md border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-negative">
          Execution konnte nicht gelöscht werden.
        </p>
      ) : null}
      <TradeDetailView
        trade={trade}
        accounts={accountsResult.data ?? []}
        strategies={strategiesResult.data ?? []}
        updateAction={boundUpdateAction}
        createExecutionAction={boundCreateExecutionAction}
        deleteExecutionAction={boundDeleteExecutionAction}
      />
    </div>
  );
}
