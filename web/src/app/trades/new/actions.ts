"use server";

import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { parseTradeForm, type TradeFormState } from "@/lib/validation/trade";

export async function createTradeAction(
  _prevState: TradeFormState,
  formData: FormData
): Promise<TradeFormState> {
  const result = parseTradeForm(formData);

  if (!result.success) {
    return { fieldErrors: result.fieldErrors, formError: result.formError };
  }

  let tradeId: string;

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("trades")
      .insert(result.data)
      .select("id")
      .single();

    if (error) {
      console.error("createTradeAction failed", error);
      return {
        fieldErrors: {},
        formError: "Trade konnte nicht gespeichert werden. Bitte später erneut versuchen.",
      };
    }

    tradeId = data.id;
  } catch (e) {
    console.error("createTradeAction failed", e);
    return {
      fieldErrors: {},
      formError: "Trade konnte nicht gespeichert werden. Bitte später erneut versuchen.",
    };
  }

  redirect(`/trades/${tradeId}`);
}
