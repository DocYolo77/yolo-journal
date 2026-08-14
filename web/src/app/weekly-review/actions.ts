"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendAuditEvent } from "@/lib/audit";
import { upsertWeeklyReview } from "@/lib/data/weekly-review";
import { finalizeWeeklyReview, hasWeeklyReportSnapshot } from "@/lib/data/weekly-report-snapshot";
import { parseWeeklyReviewForm, type WeeklyReviewFormState } from "@/lib/validation/weekly-review";

export async function saveWeeklyReviewAction(
  weekStart: string,
  weekEnd: string,
  _prevState: WeeklyReviewFormState,
  formData: FormData
): Promise<WeeklyReviewFormState> {
  // Once a report has been finalized for this week, the review that fed
  // it must stay exactly as it was — same "no silent overwrite"
  // reasoning as a LOCKED Commitment / a finalized Daily Review.
  if (await hasWeeklyReportSnapshot(weekStart)) {
    return {
      fieldErrors: {},
      formError: "Für diese Woche wurde bereits ein Report finalisiert — der Review ist unveränderlich.",
    };
  }

  const result = parseWeeklyReviewForm(formData);
  if (!result.success) {
    return { fieldErrors: result.fieldErrors, formError: result.formError };
  }

  const upsertResult = await upsertWeeklyReview(weekStart, weekEnd, result.data);
  if (!upsertResult.data) {
    return { fieldErrors: {}, formError: upsertResult.error };
  }

  await appendAuditEvent({
    eventType: "weekly_review_saved",
    tradeDate: weekStart,
    entityType: "weekly_review",
    entityId: upsertResult.data.id,
    payload: { week_start: weekStart, week_end: weekEnd },
  });

  revalidatePath("/weekly-review");
  revalidatePath("/archive");

  return { fieldErrors: {}, success: true };
}

export type FinalizeWeeklyReviewState = { error: string | null };

export async function finalizeWeeklyReviewAction(
  weekStart: string,
  _prevState: FinalizeWeeklyReviewState,
  formData: FormData
): Promise<FinalizeWeeklyReviewState> {
  void formData;

  const result = await finalizeWeeklyReview(weekStart);
  if (!result.data) {
    return { error: result.error };
  }

  revalidatePath("/weekly-review");
  revalidatePath("/archive");
  redirect(`/reports/weekly/${weekStart}`);
}
