import { PageHeader } from "@/components/layout/page-header";
import { CommitmentForm } from "@/components/commitment/commitment-form";
import { LockedCommitmentView } from "@/components/commitment/locked-commitment-view";
import { getCurrentTradeDateET } from "@/lib/trade-date";
import {
  getLatestCommitmentForDate,
  listRecentAuditEventsForTradeDate,
  listRiskChanges,
} from "@/lib/data/commitments";
import { lockAction, reduceRiskAction, saveDraftAction } from "./actions";

// Always reflects the live state of today's commitment; never a
// build-time snapshot.
export const dynamic = "force-dynamic";

export default async function PreMarketCommitmentPage() {
  const tradeDate = getCurrentTradeDateET();

  const commitmentResult = await getLatestCommitmentForDate(tradeDate);

  if (commitmentResult.error) {
    return (
      <div>
        <PageHeader title="Pre-Market Commitment" description={`Trade-Datum: ${tradeDate}`} />
        <p className="rounded-md border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-negative">
          {commitmentResult.error}
        </p>
      </div>
    );
  }

  const commitment = commitmentResult.data;

  if (commitment && commitment.status === "LOCKED") {
    const [riskChangesResult, auditEventsResult] = await Promise.all([
      listRiskChanges(commitment.id),
      listRecentAuditEventsForTradeDate(tradeDate),
    ]);

    return (
      <div>
        <PageHeader title="Pre-Market Commitment" description={`Trade-Datum: ${tradeDate}`} />
        <LockedCommitmentView
          commitment={commitment}
          riskChanges={riskChangesResult.data ?? []}
          auditEvents={auditEventsResult.data ?? []}
          reduceRiskAction={reduceRiskAction}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Pre-Market Commitment"
        description={`Trade-Datum: ${tradeDate} · Sieben Pflichtfelder, versionierter Lock, nur abwärts veränderbares Intraday-Risiko.`}
      />
      <CommitmentForm action={saveDraftAction} lockAction={lockAction} existing={commitment} />
    </div>
  );
}
