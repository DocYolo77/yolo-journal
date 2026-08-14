import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { WeeklyReviewRow } from "@/lib/supabase/types";
import type { WeeklyReviewInput } from "@/lib/validation/weekly-review";

export async function getWeeklyReview(
  weekStart: string
): Promise<{ data: WeeklyReviewRow | null; error: null } | { data: null; error: string }> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("weekly_reviews").select("*").eq("week_start", weekStart).maybeSingle();

    if (error) {
      console.error("getWeeklyReview failed", error);
      return { data: null, error: "Weekly Review konnte nicht geladen werden." };
    }

    return { data: (data as WeeklyReviewRow | null) ?? null, error: null };
  } catch (e) {
    console.error("getWeeklyReview failed", e);
    return { data: null, error: "Weekly Review konnte nicht geladen werden." };
  }
}

/**
 * Upserts the manual/interpretation fields for a week (one row per
 * week_start, overwritten in place — same as upsertDailyReview, no
 * revision history for the DRAFT state, unlike Commitment). Automatic
 * aggregation is never stored here — it's recomputed on every page load
 * (lib/weekly-review/aggregate.ts) until finalization freezes it.
 */
export async function upsertWeeklyReview(
  weekStart: string,
  weekEnd: string,
  input: WeeklyReviewInput
): Promise<{ data: WeeklyReviewRow; error: null } | { data: null; error: string }> {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("weekly_reviews")
      .upsert({ week_start: weekStart, week_end: weekEnd, ...input }, { onConflict: "week_start" })
      .select("*")
      .single();

    if (error || !data) {
      console.error("upsertWeeklyReview failed", error);
      return { data: null, error: "Weekly Review konnte nicht gespeichert werden." };
    }

    return { data: data as WeeklyReviewRow, error: null };
  } catch (e) {
    console.error("upsertWeeklyReview failed", e);
    return { data: null, error: "Weekly Review konnte nicht gespeichert werden." };
  }
}
