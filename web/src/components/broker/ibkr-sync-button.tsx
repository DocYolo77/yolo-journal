"use client";

import { useActionState } from "react";
import type { IbkrSyncActionState } from "@/app/shadowlist/actions";
import type { LatestSyncRun } from "@/lib/data/broker-sync";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("de-DE");
}

function formatCurrency(value: number | null): string {
  return value == null ? "–" : value.toLocaleString("de-DE", { maximumFractionDigits: 2 });
}

const STATUS_LABEL: Record<string, string> = {
  success: "erfolgreich",
  partial: "teilweise erfolgreich",
  failed: "fehlgeschlagen",
};

const STATUS_BOX_CLASS: Record<string, string> = {
  success: "border-positive/40 bg-positive/10 text-positive",
  partial: "border-accent/40 bg-accent/10 text-accent",
  failed: "border-negative/40 bg-negative/10 text-negative",
};

export function IbkrSyncButton({
  action,
  lastRun,
}: {
  action: (state: IbkrSyncActionState, formData: FormData) => Promise<IbkrSyncActionState>;
  lastRun: LatestSyncRun | null;
}) {
  const [state, formAction, pending] = useActionState(action, { result: null, error: null });

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          {!state.result && !pending ? (
            lastRun ? (
              <p>
                Letzter Sync: <span className="font-medium text-foreground">{lastRun.status}</span> · gestartet{" "}
                {formatDateTime(lastRun.started_at)}
                {lastRun.completed_at ? `, beendet ${formatDateTime(lastRun.completed_at)}` : " (läuft…)"}
                {lastRun.error_summary ? ` — ${lastRun.error_summary}` : ""}
              </p>
            ) : (
              <p>Noch kein IBKR-Sync durchgeführt.</p>
            )
          ) : null}
        </div>
        <form action={formAction}>
          <button
            type="submit"
            disabled={pending}
            className="shrink-0 rounded-md border border-accent px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/10 disabled:opacity-60"
          >
            {pending ? "Synchronisiere…" : "Sync IBKR now"}
          </button>
        </form>
      </div>

      {state.error ? (
        <p className="rounded-md border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-negative">
          {state.error}
        </p>
      ) : null}

      {state.result ? (
        <div className={`rounded-md border px-3 py-2 text-sm ${STATUS_BOX_CLASS[state.result.status]}`}>
          <p className="font-medium">
            Sync {STATUS_LABEL[state.result.status]} · {formatDateTime(state.result.completedAt)}
          </p>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Executions importiert</dt>
              <dd>
                {state.result.executionsImported}
                {state.result.executionsSkipped > 0 ? ` (übersprungen: ${state.result.executionsSkipped})` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">NLV</dt>
              <dd>{formatCurrency(state.result.netLiquidationValue)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Positionen</dt>
              <dd>{state.result.positionsCount}</dd>
            </div>
          </dl>
          {state.result.notes.length > 0 ? (
            <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs">
              {state.result.notes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
