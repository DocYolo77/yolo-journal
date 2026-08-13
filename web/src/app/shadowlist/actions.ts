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

export type SyncRequestState = { error: string | null };

/**
 * "Sync IBKR now" — the deployed app cannot call the
 * Interactive_Brokers_IBKR MCP connector itself (see
 * docs/ibkr-agent-sync-runbook.md), so this only records the request.
 * The next scheduled sync Routine firing checks manual_sync_requests
 * before its normal DST time-window guard and, if a pending row exists,
 * runs immediately regardless of time of day.
 */
export async function requestIbkrSyncAction(
  prevState: SyncRequestState,
  formData: FormData
): Promise<SyncRequestState> {
  // Both params are unused but required so this action matches the
  // (state, formData) => State signature useActionState expects.
  void prevState;
  void formData;

  const supabase = getSupabaseAdmin();

  try {
    const { data: inserted, error: insertError } = await supabase
      .from("manual_sync_requests")
      .insert({ status: "pending" })
      .select("id")
      .single();

    if (insertError || !inserted) {
      console.error("requestIbkrSyncAction: insert failed", insertError);
      return { error: "Sync-Anfrage konnte nicht gespeichert werden." };
    }

    await appendAuditEvent({
      eventType: "ibkr_manual_sync_requested",
      tradeDate: null,
      entityType: "manual_sync_request",
      entityId: inserted.id,
      payload: null,
    });
  } catch (e) {
    console.error("requestIbkrSyncAction failed", e);
    return { error: "Sync-Anfrage konnte nicht gespeichert werden." };
  }

  revalidatePath("/shadowlist");
  return { error: null };
}
