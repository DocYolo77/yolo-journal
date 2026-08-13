"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  EXECUTION_SIDES,
  emptyExecutionFormState,
  type ExecutionFormState,
} from "@/lib/validation/execution";
import { FieldDateTime, FieldNumber, FieldSelect, FieldText } from "@/components/ui/form-fields";

const SIDE_LABELS: Record<string, string> = {
  buy: "Buy",
  sell: "Sell",
};

export function ExecutionForm({
  action,
}: {
  action: (state: ExecutionFormState, formData: FormData) => Promise<ExecutionFormState>;
}) {
  const [state, formAction, pending] = useActionState(action, emptyExecutionFormState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  const errors = state.fieldErrors;

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-4 rounded-lg border border-dashed border-border p-4"
    >
      {state.formError ? (
        <p className="rounded-md border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-negative">
          {state.formError}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FieldSelect
          name="side"
          label="Side"
          error={errors.side}
          required
          placeholder="Bitte wählen"
          options={EXECUTION_SIDES.map((s) => ({ value: s, label: SIDE_LABELS[s] }))}
        />
        <FieldDateTime name="executedAt" label="Zeitpunkt" error={errors.executedAt} required />
        <FieldNumber name="quantity" label="Menge" error={errors.quantity} required min={0} />
        <FieldNumber name="price" label="Preis" error={errors.price} />
        <FieldNumber name="fees" label="Fees" error={errors.fees} min={0} />
        <FieldText name="notes" label="Notiz" error={errors.notes} />
      </div>
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90 disabled:opacity-60"
        >
          {pending ? "Speichern…" : "Execution hinzufügen"}
        </button>
      </div>
    </form>
  );
}
