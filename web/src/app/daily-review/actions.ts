"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendAuditEvent } from "@/lib/audit";
import { upsertDailyReview } from "@/lib/data/daily-review";
import { finalizeDailyReview, hasReportSnapshot } from "@/lib/data/report-snapshot";
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
