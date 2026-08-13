import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { TradeForm } from "@/components/trades/trade-form";
import { listActiveAccounts } from "@/lib/data/accounts";
import { listActiveStrategies } from "@/lib/data/strategies";
import { createTradeAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function NewTradePage() {
  const [accountsResult, strategiesResult] = await Promise.all([
    listActiveAccounts(),
    listActiveStrategies(),
  ]);

  return (
    <div>
      <PageHeader title="Neuer Trade" description="Erfasse die Eckdaten eines neuen Trades." />

      {accountsResult.error || strategiesResult.error ? (
        <p className="mb-4 rounded-md border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-negative">
          Accounts/Strategien konnten nicht geladen werden. Du kannst den Trade trotzdem ohne
          diese Zuordnung speichern.
        </p>
      ) : null}

      <TradeForm
        action={createTradeAction}
        accounts={accountsResult.data ?? []}
        strategies={strategiesResult.data ?? []}
        submitLabel="Trade anlegen"
      />

      <div className="mt-4">
        <Link href="/trades" className="text-sm text-muted-foreground hover:text-foreground">
          ← Zurück zur Trade-Liste
        </Link>
      </div>
    </div>
  );
}
