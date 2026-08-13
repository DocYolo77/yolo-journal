"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { parseTradeForm, type TradeFormState } from "@/lib/validation/trade";
import { parseExecutionForm, type ExecutionFormState } from "@/lib/validation/execution";
import { createExecution, deleteExecution } from "@/lib/data/executions";

export async function updateTradeAction(
  tradeId: string,
  _prevState: TradeFormState,
  formData: FormData
): Promise<TradeFormState> {
  const result = parseTradeForm(formData);

  if (!result.success) {
    return { fieldErrors: result.fieldErrors, formError: result.formError };
  }

  try {
    const { error } = await getSupabaseAdmin()
      .from("trades")
      .update(result.data)
      .eq("id", tradeId);

    if (error) {
      console.error("updateTradeAction failed", error);
      return {
        fieldErrors: {},
        formError: "Änderungen konnten nicht gespeichert werden.",
      };
    }
  } catch (e) {
    console.error("updateTradeAction failed", e);
    return {
      fieldErrors: {},
      formError: "Änderungen konnten nicht gespeichert werden.",
    };
  }

  revalidatePath(`/trades/${tradeId}`);
  revalidatePath("/trades");

  return { fieldErrors: {}, success: true };
}

export async function createExecutionAction(
  tradeId: string,
  _prevState: ExecutionFormState,
  formData: FormData
): Promise<ExecutionFormState> {
  const result = parseExecutionForm(formData);

  if (!result.success) {
    return { fieldErrors: result.fieldErrors, formError: result.formError };
  }

  const { error } = await createExecution(tradeId, result.data);

  if (error) {
    return { fieldErrors: {}, formError: error };
  }

  revalidatePath(`/trades/${tradeId}`);

  return { fieldErrors: {}, success: true };
}

export async function deleteExecutionAction(
  tradeId: string,
  executionId: string,
  formData: FormData
): Promise<void> {
  // formData is unused but required so this matches the (formData) => void
  // signature a <form action={...}> invokes after binding tradeId/executionId.
  void formData;

  const { error } = await deleteExecution(executionId);

  revalidatePath(`/trades/${tradeId}`);

  if (error) {
    redirect(`/trades/${tradeId}?executionError=1`);
  }
}
