"use client";

import { useActionState } from "react";
import type { SyncRequestState } from "@/app/shadowlist/actions";
import type { LatestSyncRun, PendingManualSyncRequest } from "@/lib/data/broker-sync";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("de-DE");
}

export function IbkrSyncButton({
  action,
  lastRun,
  pendingRequest,
}: {
  action: (state: SyncRequestState, formData: FormData) => Promise<SyncRequestState>;
  lastRun: LatestSyncRun | null;
  pendingRequest: PendingManualSyncRequest | null;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });

  const alreadyPending = pending || pendingRequest !== null;

  return (
    <div className="mb-6 flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-muted-foreground">
        {pendingRequest ? (
          <p>
            Sync angefordert um {formatDateTime(pendingRequest.requested_at)} — wird von der nächsten Routine
            abgeholt, unabhängig von der üblichen Uhrzeit.
          </p>
        ) : lastRun ? (
          <p>
            Letzter Sync: <span className="font-medium text-foreground">{lastRun.status}</span> · gestartet{" "}
            {formatDateTime(lastRun.started_at)}
            {lastRun.completed_at ? `, beendet ${formatDateTime(lastRun.completed_at)}` : " (läuft…)"}
            {lastRun.error_summary ? ` — ${lastRun.error_summary}` : ""}
          </p>
        ) : (
          <p>Noch kein IBKR-Sync durchgeführt.</p>
        )}
        {state.error ? <p className="text-negative">{state.error}</p> : null}
      </div>
      <form action={formAction}>
        <button
          type="submit"
          disabled={alreadyPending}
          className="shrink-0 rounded-md border border-accent px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/10 disabled:opacity-60"
        >
          {pending ? "Wird angefordert…" : pendingRequest ? "Sync angefordert" : "Sync IBKR now"}
        </button>
      </form>
    </div>
  );
}
