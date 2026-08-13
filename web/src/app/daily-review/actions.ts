"use server";

import { revalidatePath } from "next/cache";
import { appendAuditEvent } from "@/lib/audit";
import { upsertDailyReview } from "@/lib/data/daily-review";
import { parseDailyReviewForm, type DailyReviewFormState } from "@/lib/validation/daily-review";

export async function saveDailyReviewAction(
  tradeDate: string,
  _prevState: DailyReviewFormState,
  formData: FormData
): Promise<DailyReviewFormState> {
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
