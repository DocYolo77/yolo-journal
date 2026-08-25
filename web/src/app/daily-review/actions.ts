"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendAuditEvent } from "@/lib/audit";
import { getDailyReviewContext, upsertDailyReview } from "@/lib/data/daily-review";
import { finalizeDailyReview, getCampaignsForReview, hasReportSnapshot } from "@/lib/data/report-snapshot";
import { generateCoachSummary } from "@/lib/coach/generate-summary";
import { parseDailyReviewForm, type DailyReviewFormState } from "@/lib/validation/daily-review";

export async function saveDailyReviewAction(
  tradeDate: string,
  _prevState: DailyReviewFormState,
  formData: FormData
): Promise<DailyReviewFormState> {
  // Once a report has been finalized for this date, the review that fed
  // it must stay exactly as it was — same "no silent overwrite" reasoning
  // as a LOCKED Commitment.
  if (await hasReportSnapshot(tradeDate)) {
    return {
      fieldErrors: {},
      formError: "Für dieses Datum wurde bereits ein Report finalisiert — der Review ist unveränderlich.",
    };
  }

  const result = parseDailyReviewForm(formData);

  if (!result.success) {
    return { fieldErrors: result.fieldErrors, formError: result.formError };
  }

  const upsertResult = await upsertDailyReview(tradeDate, result.data);

  if (!upsertResult.data) {
    return { fieldErrors: {}, formError: upsertResult.error };
  }

  await appendAuditEvent({
    eventType: "daily_review_saved",
    tradeDate,
    entityType: "daily_review",
    entityId: upsertResult.data.id,
    payload: { status: result.data.status, is_reconstructed: upsertResult.data.is_reconstructed },
  });

  revalidatePath("/daily-review");
  revalidatePath("/archive");

  return { fieldErrors: {}, success: true };
}

export type GenerateCoachTakeState = { suggestion: string | null; error: string | null };

/**
 * "KI-Fazit generieren" — a single Anthropic Messages API call (see
 * lib/coach/generate-summary.ts) over whatever is currently in the form
 * (including unsaved edits, via parseDailyReviewForm on the live
 * formData) plus the locked commitment and today's campaigns. Only
 * returns a suggestion for the client to drop into the Coaching Take
 * field — never writes to the DB itself, so the user always reviews/
 * edits before the normal "Speichern" actually persists it.
 *
 * Called directly from a client onClick handler (see DailyReviewForm),
 * NOT via <form action>/useActionState — this action performs no DB
 * write, so it must never call revalidatePath: doing so previously
 * forced a full server-data refresh of the page while the user still
 * had unsaved edits sitting only in the browser, which is what was
 * wiping the rest of the review whenever this button was clicked.
 */
export async function generateCoachingTakeAction(
  tradeDate: string,
  formData: FormData
): Promise<GenerateCoachTakeState> {
  const parsed = parseDailyReviewForm(formData);
  if (!parsed.success) {
    return { suggestion: null, error: "Formular enthält Fehler — bitte zuerst korrigieren." };
  }

  const [contextResult, campaigns] = await Promise.all([
    getDailyReviewContext(tradeDate),
    getCampaignsForReview(tradeDate),
  ]);

  if (!contextResult.data) {
    return { suggestion: null, error: contextResult.error };
  }

  const result = await generateCoachSummary({
    tradeDate,
    review: parsed.data,
    commitment: contextResult.data.commitment,
    campaigns,
  });

  if (!result.text) {
    return { suggestion: null, error: result.error };
  }

  return { suggestion: result.text, error: null };
}

export type FinalizeReviewState = { error: string | null };

/**
 * "Review abschließen" — assembles and writes the immutable report
 * snapshot (see lib/data/report-snapshot.ts for the full assembly:
 * review + locked commitment + shadowlist + broker data + Massive chart
 * data), then redirects straight to the resulting report page.
 */
export async function finalizeDailyReviewAction(
  tradeDate: string,
  _prevState: FinalizeReviewState,
  formData: FormData
): Promise<FinalizeReviewState> {
  void formData;

  const result = await finalizeDailyReview(tradeDate);

  if (!result.data) {
    return { error: result.error };
  }

  revalidatePath("/daily-review");
  revalidatePath("/archive");
  redirect(`/reports/daily/${tradeDate}`);
}
