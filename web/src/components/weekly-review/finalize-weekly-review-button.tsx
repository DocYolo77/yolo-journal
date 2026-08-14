"use client";

import { useActionState } from "react";
import type { FinalizeWeeklyReviewState } from "@/app/weekly-review/actions";

export function FinalizeWeeklyReviewButton({
  action,
}: {
  action: (state: FinalizeWeeklyReviewState, formData: FormData) => Promise<FinalizeWeeklyReviewState>;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });

  return (
    <form action={formAction} className="rounded-lg border border-border bg-surface p-4">
      {state.error ? (
        <p className="mb-3 rounded-md border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-negative">
          {state.error}
        </p>
      ) : null}
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <p className="text-sm text-muted-foreground">
          Aggregiert die Woche vollständig, erzeugt einen unveränderlichen Report-Snapshot und öffnet den Report.
          Danach ist dieser Weekly Review nicht mehr editierbar.
        </p>
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-md border border-accent px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/10 disabled:opacity-60"
        >
          {pending ? "Finalisiere…" : "Weekly Review abschließen"}
        </button>
      </div>
    </form>
  );
}
