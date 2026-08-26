import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { CryptoLearningRow, CryptoTradeRow } from "@/lib/supabase/types";
import type { CryptoLearningInput } from "@/lib/validation/crypto";

export async function listCryptoLearnings(): Promise<
  { data: CryptoLearningRow[]; error: null } | { data: null; error: string }
> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("crypto_learnings").select("*").order("sort_order", { ascending: true });

    if (error) {
      console.error("listCryptoLearnings failed", error);
      return { data: null, error: "Learnings konnten nicht geladen werden." };
    }
    return { data: (data ?? []) as CryptoLearningRow[], error: null };
  } catch (e) {
    console.error("listCryptoLearnings failed", e);
    return { data: null, error: "Learnings konnten nicht geladen werden." };
  }
}

/** Copies a trade's lesson into the central Crypto Learnings collection, keeping the link back to its origin trade. */
export async function createCryptoLearningFromTrade(
  trade: Pick<CryptoTradeRow, "id" | "trade_date" | "coin" | "lesson">,
  tags: string[]
): Promise<{ data: CryptoLearningRow; error: null } | { data: null; error: string }> {
  if (!trade.lesson || !trade.lesson.trim()) {
    return { data: null, error: "Trade hat noch keine Lesson eingetragen." };
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: maxRow, error: maxError } = await supabase
      .from("crypto_learnings")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxError) {
      console.error("createCryptoLearningFromTrade: sort_order lookup failed", maxError);
      return { data: null, error: "Learning konnte nicht gespeichert werden." };
    }

    const nextOrder = maxRow ? (maxRow.sort_order as number) + 1 : 0;

    const { data, error } = await supabase
      .from("crypto_learnings")
      .insert({
        trade_id: trade.id,
        lesson: trade.lesson.trim(),
        trade_date: trade.trade_date,
        coin: trade.coin,
        tags,
        sort_order: nextOrder,
      })
      .select("*")
      .single();

    if (error || !data) {
      console.error("createCryptoLearningFromTrade failed", error);
      return { data: null, error: "Learning konnte nicht gespeichert werden." };
    }
    return { data: data as CryptoLearningRow, error: null };
  } catch (e) {
    console.error("createCryptoLearningFromTrade failed", e);
    return { data: null, error: "Learning konnte nicht gespeichert werden." };
  }
}

export async function updateCryptoLearning(
  id: string,
  input: CryptoLearningInput
): Promise<{ data: CryptoLearningRow; error: null } | { data: null; error: string }> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("crypto_learnings")
      .update({ lesson: input.lesson, tags: input.tags })
      .eq("id", id)
      .select("*")
      .single();

    if (error || !data) {
      console.error("updateCryptoLearning failed", error);
      return { data: null, error: "Learning konnte nicht gespeichert werden." };
    }
    return { data: data as CryptoLearningRow, error: null };
  } catch (e) {
    console.error("updateCryptoLearning failed", e);
    return { data: null, error: "Learning konnte nicht gespeichert werden." };
  }
}

export async function deleteCryptoLearning(id: string): Promise<{ error: string | null }> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("crypto_learnings").delete().eq("id", id);
    if (error) {
      console.error("deleteCryptoLearning failed", error);
      return { error: "Learning konnte nicht gelöscht werden." };
    }
    return { error: null };
  } catch (e) {
    console.error("deleteCryptoLearning failed", e);
    return { error: "Learning konnte nicht gelöscht werden." };
  }
}

/** Swaps `id`'s sort_order with its immediate neighbor — same pattern as lib/data/lessons-learned.ts's moveEntry, but unscoped (one free-form collection, no kind). */
export async function moveCryptoLearning(id: string, direction: "up" | "down"): Promise<{ error: string | null }> {
  try {
    const supabase = getSupabaseAdmin();

    const { data: current, error: currentError } = await supabase
      .from("crypto_learnings")
      .select("id, sort_order")
      .eq("id", id)
      .single();

    if (currentError || !current) {
      console.error("moveCryptoLearning: current lookup failed", currentError);
      return { error: "Learning nicht gefunden." };
    }

    const neighborQuery =
      direction === "up"
        ? supabase
            .from("crypto_learnings")
            .select("id, sort_order")
            .lt("sort_order", current.sort_order)
            .order("sort_order", { ascending: false })
            .limit(1)
        : supabase
            .from("crypto_learnings")
            .select("id, sort_order")
            .gt("sort_order", current.sort_order)
            .order("sort_order", { ascending: true })
            .limit(1);

    const { data: neighborRows, error: neighborError } = await neighborQuery;
    if (neighborError) {
      console.error("moveCryptoLearning: neighbor lookup failed", neighborError);
      return { error: "Learning konnte nicht verschoben werden." };
    }

    const neighbor = neighborRows?.[0];
    if (!neighbor) {
      return { error: null }; // already at the boundary
    }

    const [{ error: error1 }, { error: error2 }] = await Promise.all([
      supabase.from("crypto_learnings").update({ sort_order: neighbor.sort_order }).eq("id", current.id),
      supabase.from("crypto_learnings").update({ sort_order: current.sort_order }).eq("id", neighbor.id),
    ]);

    if (error1 || error2) {
      console.error("moveCryptoLearning: swap failed", error1, error2);
      return { error: "Learning konnte nicht verschoben werden." };
    }
    return { error: null };
  } catch (e) {
    console.error("moveCryptoLearning failed", e);
    return { error: "Learning konnte nicht verschoben werden." };
  }
}
