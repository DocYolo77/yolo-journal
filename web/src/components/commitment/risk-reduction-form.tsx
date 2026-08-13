"use client";

import { useActionState } from "react";
import { emptyCommitmentFormState, type CommitmentFormState } from "@/lib/validation/commitment";
import { FieldNumber, FieldText } from "@/components/ui/form-fields";

export function RiskReductionForm({
  action,
  currentRiskPct,
}: {
  action: (state: CommitmentFormState, formData: FormData) => Promise<CommitmentFormState>;
  currentRiskPct: number | null;
}) {
  const [state, formAction, pending] = useActionState(action, emptyCommitmentFormState);

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-dashed border-border p-4">
      <h3 className="text-sm font-semibold text-foreground">Intraday-Risiko reduzieren</h3>
      <p className="text-xs text-muted-foreground">
        Aktuell: {currentRiskPct ?? "–"}%. Nur Reduktion möglich, jede Änderung wird protokolliert.
      </p>
      {state.formError ? (
        <p className="rounded-md border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-negative">
          {state.formError}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldNumber
          name="newRiskPct"
          label="Neues Risiko (%)"
          error={state.fieldErrors.newRiskPct}
          min={0}
          required
        />
        <FieldText name="reason" label="Begründung" error={state.fieldErrors.reason} required />
      </div>
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90 disabled:opacity-60"
        >
          {pending ? "Speichern…" : "Risiko reduzieren"}
        </button>
      </div>
    </form>
  );
}
