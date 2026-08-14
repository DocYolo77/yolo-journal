"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { appendAuditEvent } from "@/lib/audit";
import { parseShadowlistForm, type ShadowlistFormState } from "@/lib/validation/shadowlist";
import { runIbkrSync, type IbkrSyncSummary } from "@/lib/broker/ibkr-sync";

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

export type IbkrSyncActionState = { result: IbkrSyncSummary | null; error: string | null };

/**
 * "Sync IBKR now" — runs the full direct IBKR Flex Web Service sync
 * (lib/broker/ibkr-sync.ts) synchronously on the deployed server and
 * returns a rich result the button renders immediately. No Claude/MCP/
 * agent dependency (superseded docs/ibkr-agent-sync-runbook.md's
 * scheduled-agent-turn approach, which needed the Interactive_Brokers_
 * IBKR MCP connector and could take up to ~12h to pick up a manual
 * request).
 */
export async function runIbkrSyncAction(
  prevState: IbkrSyncActionState,
  formData: FormData
): Promise<IbkrSyncActionState> {
  // Both params are unused but required so this action matches the
  // (state, formData) => State signature useActionState expects.
  void prevState;
  void formData;

  try {
    const result = await runIbkrSync();
    revalidatePath("/shadowlist");
    revalidatePath("/archive");
    return { result, error: null };
  } catch (e) {
    console.error("runIbkrSyncAction failed", e);
    const message = e instanceof Error ? e.message : "IBKR-Sync fehlgeschlagen.";
    return { result: null, error: message };
  }
}
