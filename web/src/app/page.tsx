import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { CommitmentForm } from "@/components/commitment/commitment-form";
import { LockedCommitmentView } from "@/components/commitment/locked-commitment-view";
import { getCurrentTradeDateET, isValidTradeDate, shiftTradeDate } from "@/lib/trade-date";
import {
  getLatestCommitmentForDate,
  listRecentAuditEventsForTradeDate,
  listRiskChanges,
} from "@/lib/data/commitments";
import { lockAction, reduceRiskAction, saveDraftAction } from "./actions";

// Always reflects the live state of the selected date's commitment;
// never a build-time snapshot.
export const dynamic = "force-dynamic";

export default async function PreMarketCommitmentPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const today = getCurrentTradeDateET();
  const tradeDate = date && isValidTradeDate(date) ? date : today;
  const isBackfill = tradeDate !== today;

  const dateNav = (
    <div className="mb-4 flex items-center justify-between text-sm">
      <Link href={`/?date=${shiftTradeDate(tradeDate, -1)}`} className="text-muted-foreground hover:text-foreground">
        ← Vorheriger Tag
      </Link>
      <span className="text-foreground">{tradeDate}</span>
      {isBackfill ? (
        <Link href="/" className="text-muted-foreground hover:text-foreground">
          Heute →
        </Link>
      ) : (
        <Link href={`/?date=${shiftTradeDate(tradeDate, 1)}`} className="text-muted-foreground hover:text-foreground">
          Nächster Tag →
        </Link>
      )}
    </div>
  );

  const backfillBanner = isBackfill ? (
    <div className="mb-4 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent">
      Nachträglich erfasst — dies ist kein echtes Pre-Market Commitment (nicht vor Markteröffnung
      erstellt), sondern eine bewusste Nacherfassung für einen verpassten Tag.
    </div>
  ) : null;

  const boundSaveDraft = saveDraftAction.bind(null, tradeDate);
  const boundLock = lockAction.bind(null, tradeDate);
  const boundReduceRisk = reduceRiskAction.bind(null, tradeDate);

  const commitmentResult = await getLatestCommitmentForDate(tradeDate);

  if (commitmentResult.error) {
    return (
      <div>
        <PageHeader title="Pre-Market Commitment" description={`Trade-Datum: ${tradeDate}`} />
        {dateNav}
        {backfillBanner}
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
        {dateNav}
        {backfillBanner}
        <LockedCommitmentView
          commitment={commitment}
          riskChanges={riskChangesResult.data ?? []}
          auditEvents={auditEventsResult.data ?? []}
          reduceRiskAction={boundReduceRisk}
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
      {dateNav}
      {backfillBanner}
      <CommitmentForm
        action={boundSaveDraft}
        lockAction={boundLock}
        existing={commitment}
        allowLiveMassiveFetch={!isBackfill}
      />
    </div>
  );
}
