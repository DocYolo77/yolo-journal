"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { parseTradeForm, type TradeFormState } from "@/lib/validation/trade";

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
