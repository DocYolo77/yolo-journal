import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { DecisionEditor } from "@/components/shadowlist/decision-editor";
import { IbkrSyncButton } from "@/components/broker/ibkr-sync-button";
import { getLatestCommitmentForDate } from "@/lib/data/commitments";
import { computeShadowlistSummary, getOrCreateShadowlistDecisions } from "@/lib/data/shadowlist";
import { getLatestSyncStatus } from "@/lib/data/broker-sync";
import { getCurrentTradeDateET, isValidTradeDate, shiftTradeDate } from "@/lib/trade-date";
import { requestIbkrSyncAction, saveShadowlistDecisionsAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ShadowlistPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const tradeDate = date && isValidTradeDate(date) ? date : getCurrentTradeDateET();

  const dateNav = (
    <div className="mb-4 flex items-center justify-between text-sm">
      <Link
        href={`/shadowlist?date=${shiftTradeDate(tradeDate, -1)}`}
        className="text-muted-foreground hover:text-foreground"
      >
        ← Vorheriger Tag
      </Link>
      <span className="text-foreground">{tradeDate}</span>
      <Link
        href={`/shadowlist?date=${shiftTradeDate(tradeDate, 1)}`}
        className="text-muted-foreground hover:text-foreground"
      >
        Nächster Tag →
      </Link>
    </div>
  );

  const syncStatusResult = await getLatestSyncStatus();
  const syncButton = syncStatusResult.data ? (
    <IbkrSyncButton
      action={requestIbkrSyncAction}
      lastRun={syncStatusResult.data.lastRun}
      pendingRequest={syncStatusResult.data.pendingManualRequest}
    />
  ) : null;

  const commitmentResult = await getLatestCommitmentForDate(tradeDate);

  if (commitmentResult.error) {
    return (
      <div>
        <PageHeader title="Shadowlist" description="Stock Selection Audit" />
        {syncButton}
        {dateNav}
        <p className="rounded-md border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-negative">
          {commitmentResult.error}
        </p>
      </div>
    );
  }

  const commitment = commitmentResult.data;

  if (!commitment || commitment.status !== "LOCKED") {
    return (
      <div>
        <PageHeader title="Shadowlist" description="Stock Selection Audit" />
        {syncButton}
        {dateNav}
        <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          Kein gelocktes Commitment für dieses Datum. Die Shadowlist baut auf dem gelockten Pre-Market
          Commitment auf.{" "}
          {tradeDate === getCurrentTradeDateET() ? (
            <Link href="/" className="text-accent hover:underline">
              Jetzt committen
            </Link>
          ) : (
            <Link href={`/?date=${tradeDate}`} className="text-accent hover:underline">
              Commitment nachtragen
            </Link>
          )}
        </div>
      </div>
    );
  }

  const decisionsResult = await getOrCreateShadowlistDecisions(commitment);

  if (!decisionsResult.data) {
    return (
      <div>
        <PageHeader title="Shadowlist" description="Stock Selection Audit" />
        {syncButton}
        {dateNav}
        <p className="rounded-md border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-negative">
          {decisionsResult.error}
        </p>
      </div>
    );
  }

  const decisions = decisionsResult.data;
  const summary = computeShadowlistSummary(decisions);
  const boundAction = saveShadowlistDecisionsAction.bind(null, commitment.id, tradeDate);

  return (
    <div>
      <PageHeader
        title="Shadowlist"
        description="Stock Selection Audit — vorab ausgewählte Namen getrennt von Execution und Management messen."
      />
      {syncButton}
      {dateNav}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard label="Committed Slots" value={String(summary.committedSlots)} />
        <SummaryCard label="Prime Slots" value={String(summary.primeSlots)} />
        <SummaryCard label="Genommen" value={String(summary.genommen)} />
        <SummaryCard label="Shadow" value={String(summary.shadow)} />
        <SummaryCard
          label="Take Rate"
          value={summary.takeRatePct != null ? `${summary.takeRatePct.toFixed(0)}%` : "–"}
        />
      </div>

      {decisions.length > 0 ? (
        <DecisionEditor decisions={decisions} action={boundAction} />
      ) : (
        <p className="text-sm text-muted-foreground">Keine committed Ticker für diesen Tag.</p>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
