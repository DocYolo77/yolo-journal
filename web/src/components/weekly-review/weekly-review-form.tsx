"use client";

import { useActionState, type ReactNode } from "react";
import { FieldSelect, FieldTextarea } from "@/components/ui/form-fields";
import { PROCESS_GRADES, emptyWeeklyReviewFormState, type WeeklyReviewFormState } from "@/lib/validation/weekly-review";
import type { WeeklyReviewRow } from "@/lib/supabase/types";

export function WeeklyReviewForm({
  action,
  weekStart,
  review,
}: {
  action: (state: WeeklyReviewFormState, formData: FormData) => Promise<WeeklyReviewFormState>;
  weekStart: string;
  review: WeeklyReviewRow | null;
}) {
  const [state, formAction, pending] = useActionState(action, emptyWeeklyReviewFormState);

  return (
    <form action={formAction} className="space-y-6">
      {state.formError ? (
        <p className="rounded-md border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-negative">
          {state.formError}
        </p>
      ) : null}
      {state.success ? (
        <p className="rounded-md border border-positive/40 bg-positive/10 px-3 py-2 text-sm text-positive">Gespeichert.</p>
      ) : null}

      <Section title="Preconditions">
        <FieldTextarea
          name="preconditionsNote"
          label="Was war die Ausgangslage dieser Woche?"
          defaultValue={review?.preconditions_note ?? ""}
        />
      </Section>

      <Section title="Worked / Not Worked">
        <FieldTextarea name="worked" label="Was hat funktioniert?" defaultValue={review?.worked ?? ""} />
        <FieldTextarea name="notWorked" label="Was hat nicht funktioniert?" defaultValue={review?.not_worked ?? ""} />
      </Section>

      <Section title="Largest Missed Move">
        <FieldTextarea
          name="largestMissedMoveComment"
          label="Warum habe ich diesen Move nicht genommen?"
          defaultValue={review?.largest_missed_move_comment ?? ""}
        />
      </Section>

      <Section title="Weekly Interpretation">
        <FieldTextarea name="continueDoing" label="Weiter so — was soll unverändert bleiben?" defaultValue={review?.continue_doing ?? ""} />
        <FieldTextarea name="improve" label="Verbessern — was soll gezielt verbessert werden?" defaultValue={review?.improve ?? ""} />
        <FieldTextarea name="eliminate" label="Eliminieren — welches Verhalten soll verschwinden?" defaultValue={review?.eliminate ?? ""} />
        <FieldTextarea
          name="nextWeekChanges"
          label="Konkrete Änderung nächste Woche (max. 1-3 operative Punkte)"
          defaultValue={review?.next_week_changes ?? ""}
        />
      </Section>

      <Section title="Process Grade">
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldSelect
            name="processGrade"
            label="Process Grade"
            defaultValue={review?.process_grade ?? undefined}
            options={PROCESS_GRADES.map((g) => ({ value: g, label: g }))}
            placeholder="Bitte wählen"
          />
        </div>
        <FieldTextarea name="processGradeReason" label="Begründung" defaultValue={review?.process_grade_reason ?? ""} />
        <p className="text-xs text-muted-foreground">
          Die Process Grade wird nicht automatisch aus Wochenrendite oder P&L berechnet — eine profitable Woche kann
          schlechten Prozess enthalten, eine Verlustwoche sehr guten.
        </p>
      </Section>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90 disabled:opacity-60"
        >
          {pending ? "Speichern…" : `Weekly Review für ${weekStart} speichern`}
        </button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-lg border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}
