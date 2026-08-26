import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { CryptoLearningRow, CryptoTradeRow, CryptoWeeklyReviewRow } from "@/lib/supabase/types";
import type { CryptoWeeklyReviewInput } from "@/lib/validation/crypto";

export type CryptoWeeklyMetrics = {
  tradesCount: number;
  pnlUsd: number;
  pnlR: number;
};

/** Trades count / PnL$ / PnL R are always computed live from crypto_trades — never persisted, same principle as the stock Weekly Review's own aggregation. */
export function computeCryptoWeeklyMetrics(trades: Pick<CryptoTradeRow, "result_usd" | "result_r">[]): CryptoWeeklyMetrics {
  return {
    tradesCount: trades.length,
    pnlUsd: trades.reduce((sum, t) => sum + (t.result_usd ?? 0), 0),
    pnlR: trades.reduce((sum, t) => sum + (t.result_r ?? 0), 0),
  };
}

export async function getCryptoTradesForWeek(
  weekStart: string,
  weekEnd: string
): Promise<{ data: CryptoTradeRow[]; error: null } | { data: null; error: string }> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("crypto_trades")
      .select("*")
      .gte("trade_date", weekStart)
      .lte("trade_date", weekEnd)
      .order("trade_date", { ascending: true });

    if (error) {
      console.error("getCryptoTradesForWeek failed", error);
      return { data: null, error: "Crypto-Trades der Woche konnten nicht geladen werden." };
    }
    return { data: (data ?? []) as CryptoTradeRow[], error: null };
  } catch (e) {
    console.error("getCryptoTradesForWeek failed", e);
    return { data: null, error: "Crypto-Trades der Woche konnten nicht geladen werden." };
  }
}

export async function getCryptoLearningsForWeek(
  weekStart: string,
  weekEnd: string
): Promise<{ data: CryptoLearningRow[]; error: null } | { data: null; error: string }> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("crypto_learnings")
      .select("*")
      .gte("created_at", `${weekStart}T00:00:00.000Z`)
      .lte("created_at", `${weekEnd}T23:59:59.999Z`)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("getCryptoLearningsForWeek failed", error);
      return { data: null, error: "Learnings der Woche konnten nicht geladen werden." };
    }
    return { data: (data ?? []) as CryptoLearningRow[], error: null };
  } catch (e) {
    console.error("getCryptoLearningsForWeek failed", e);
    return { data: null, error: "Learnings der Woche konnten nicht geladen werden." };
  }
}

export async function getCryptoWeeklyReview(
  weekStart: string
): Promise<{ data: CryptoWeeklyReviewRow | null; error: null } | { data: null; error: string }> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("crypto_weekly_reviews")
      .select("*")
      .eq("week_start", weekStart)
      .maybeSingle();

    if (error) {
      console.error("getCryptoWeeklyReview failed", error);
      return { data: null, error: "Crypto Weekly Review konnte nicht geladen werden." };
    }
    return { data: (data as CryptoWeeklyReviewRow | null) ?? null, error: null };
  } catch (e) {
    console.error("getCryptoWeeklyReview failed", e);
    return { data: null, error: "Crypto Weekly Review konnte nicht geladen werden." };
  }
}

export async function upsertCryptoWeeklyReview(
  weekStart: string,
  weekEnd: string,
  input: CryptoWeeklyReviewInput
): Promise<{ data: CryptoWeeklyReviewRow; error: null } | { data: null; error: string }> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("crypto_weekly_reviews")
      .upsert({ week_start: weekStart, week_end: weekEnd, ...input }, { onConflict: "week_start" })
      .select("*")
      .single();

    if (error || !data) {
      console.error("upsertCryptoWeeklyReview failed", error);
      return { data: null, error: "Crypto Weekly Review konnte nicht gespeichert werden." };
    }
    return { data: data as CryptoWeeklyReviewRow, error: null };
  } catch (e) {
    console.error("upsertCryptoWeeklyReview failed", e);
    return { data: null, error: "Crypto Weekly Review konnte nicht gespeichert werden." };
  }
}
