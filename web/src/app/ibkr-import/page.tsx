import { PageHeader } from "@/components/layout/page-header";
import { IbkrImportForm } from "@/components/ibkr-import/ibkr-import-form";
import { getCurrentTradeDateET } from "@/lib/trade-date";

export const dynamic = "force-dynamic";

export default function IbkrImportPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="IBKR Import"
        description="Manueller Fallback für den automatischen IBKR-Sync — importierte Daten laufen durch dieselbe Engine (Executions, Campaigns, Account-/Portfolio-Snapshots) wie ein erfolgreicher Sync und werden vom Daily Review automatisch anhand des Datums erkannt."
      />
      <IbkrImportForm defaultDate={getCurrentTradeDateET()} />
    </div>
  );
}
