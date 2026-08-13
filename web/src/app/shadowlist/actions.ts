"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { appendAuditEvent } from "@/lib/audit";
import { parseShadowlistForm, type ShadowlistFormState } from "@/lib/validation/shadowlist";

export async function saveShadowlistDecisionsAction(
  commitmentId: string,
  tradeDate: string,
  _prevState: ShadowlistFormState,
  formData: FormData
): Promise<ShadowlistFormState> {
  const result = parseShadowlistForm(formData);

  if (!result.success) {
    return { fieldErrors: result.fieldErrors, formError: result.formError };
  }

  const supabase = getSupabaseAdmin();

  try {
    for (const update of result.data) {
      const { error } = await supabase
        .from("shadowlist_decisions")
        .update({
          decision: update.decision,
          reason: update.reason,
          notes: update.notes,
        })
        .eq("id", update.id)
        .eq("commitment_id", commitmentId);

      if (error) {
        console.error("saveShadowlistDecisionsAction: update failed", error);
        return { fieldErrors: {}, formError: "Shadowlist konnte nicht gespeichert werden." };
      }
    }

    await appendAuditEvent({
      eventType: "shadowlist_scored",
      tradeDate,
      entityType: "shadowlist",
      entityId: commitmentId,
      payload: { updatedCount: result.data.length },
    });
  } catch (e) {
    console.error("saveShadowlistDecisionsAction failed", e);
    return { fieldErrors: {}, formError: "Shadowlist konnte nicht gespeichert werden." };
  }

  revalidatePath("/shadowlist");

  return { fieldErrors: {}, success: true };
}
