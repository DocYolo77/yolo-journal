"use client";

import { useActionState } from "react";
import type { FinalizeReviewState } from "@/app/daily-review/actions";

export function FinalizeReviewButton({
  action,
  guardrailsReviewed,
}: {
  action: (state: FinalizeReviewState, formData: FormData) => Promise<FinalizeReviewState>;
  guardrailsReviewed: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });

  return (
    <form action={formAction} className="rounded-lg border border-border bg-surface p-4">
      {state.error ? (
        <p className="mb-3 rounded-md border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-negative">
          {state.error}
        </p>
      ) : null}
      {!guardrailsReviewed ? (
        <p className="mb-3 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent">
          Erst &bdquo;Guardrails geprüft?&rdquo; ankreuzen und speichern, dann kann der Review abgeschlossen werden.
        </p>
      ) : null}
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <p className="text-sm text-muted-foreground">
          Erzeugt einen unveränderlichen Report-Snapshot (Review, Commitment, Shadowlist, Marktdaten) und öffnet
          den Report. Danach ist dieser Review nicht mehr editierbar.
        </p>
        <button
          type="submit"
          disabled={pending || !guardrailsReviewed}
          className="shrink-0 rounded-md border border-accent px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/10 disabled:opacity-60"
        >
          {pending ? "Finalisiere…" : "Review abschließen"}
        </button>
      </div>
    </form>
  );
}
