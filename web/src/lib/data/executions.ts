import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { ExecutionInsertInput } from "@/lib/validation/execution";

export async function createExecution(
  tradeId: string,
  input: ExecutionInsertInput
): Promise<{ error: string | null }> {
  try {
    const { error } = await getSupabaseAdmin()
      .from("executions")
      .insert({ ...input, trade_id: tradeId });

    if (error) {
      console.error("createExecution failed", error);
      return { error: "Execution konnte nicht gespeichert werden." };
    }

    return { error: null };
  } catch (e) {
    console.error("createExecution failed", e);
    return { error: "Execution konnte nicht gespeichert werden." };
  }
}

export async function deleteExecution(executionId: string): Promise<{ error: string | null }> {
  try {
    const { error } = await getSupabaseAdmin()
      .from("executions")
      .delete()
      .eq("id", executionId);

    if (error) {
      console.error("deleteExecution failed", error);
      return { error: "Execution konnte nicht gelöscht werden." };
    }

    return { error: null };
  } catch (e) {
    console.error("deleteExecution failed", e);
    return { error: "Execution konnte nicht gelöscht werden." };
  }
}
