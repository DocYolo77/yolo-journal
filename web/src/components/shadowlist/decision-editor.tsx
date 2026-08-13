"use client";

import { useActionState, useState } from "react";
import {
  DECISIONS,
  emptyShadowlistFormState,
  REASONS,
  type ShadowlistFormState,
} from "@/lib/validation/shadowlist";
import type { ShadowlistDecisionRow } from "@/lib/supabase/types";

type RowState = { id: string; decision: string; reason: string; notes: string };

function toRowState(rows: ShadowlistDecisionRow[]): RowState[] {
  return rows.map((r) => ({
    id: r.id,
    decision: r.decision,
    reason: r.reason ?? "",
    notes: r.notes ?? "",
  }));
}

const inputClass =
  "rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none";

export function DecisionEditor({
  decisions,
  action,
}: {
  decisions: ShadowlistDecisionRow[];
  action: (state: ShadowlistFormState, formData: FormData) => Promise<ShadowlistFormState>;
}) {
  const [state, formAction, pending] = useActionState(action, emptyShadowlistFormState);
  const [rows, setRows] = useState<RowState[]>(() => toRowState(decisions));

  function updateRow(id: string, patch: Partial<RowState>) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  const metaById = new Map(decisions.map((d) => [d.id, d]));

  return (
    <form action={formAction} className="space-y-4">
      {state.formError ? (
        <p className="rounded-md border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-negative">
          {state.formError}
        </p>
      ) : null}

      <input type="hidden" name="decisionsJson" value={JSON.stringify(rows)} readOnly />

      <div className="space-y-3">
        {rows.map((row) => {
          const meta = metaById.get(row.id);
          if (!meta) return null;
          const error = state.fieldErrors[row.id];

          return (
            <div key={row.id} className="rounded-md border border-border bg-surface p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="font-medium text-foreground">{meta.ticker}</span>
                <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  {meta.list_type}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <select
                  value={row.decision}
                  onChange={(e) =>
                    updateRow(row.id, {
                      decision: e.target.value,
                      reason: e.target.value === "Genommen" ? "" : row.reason,
                    })
                  }
                  className={inputClass}
                >
                  {DECISIONS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                {row.decision === "Nicht genommen" ? (
                  <select
                    value={row.reason}
                    onChange={(e) => updateRow(row.id, { reason: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">Grund wählen</option>
                    {REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div />
                )}
                <input
                  type="text"
                  value={row.notes}
                  onChange={(e) => updateRow(row.id, { notes: e.target.value })}
                  placeholder="Notiz"
                  className={inputClass}
                />
              </div>
              {error ? <p className="mt-1 text-xs text-negative">{error}</p> : null}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90 disabled:opacity-60"
        >
          {pending ? "Speichern…" : "Shadowlist speichern"}
        </button>
      </div>
    </form>
  );
}
