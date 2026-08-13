import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { DailyReviewRow } from "@/lib/supabase/types";
import { getLatestCommitmentForDate, type CommitmentWithChildren } from "@/lib/data/commitments";
import type { DailyReviewInput } from "@/lib/validation/daily-review";

export type DailyReviewContext = {
  review: DailyReviewRow | null;
  commitment: CommitmentWithChildren | null;
};

/**
 * Loads the Daily Review for trade_date plus whatever locked commitment
 * exists for that date (context for the "committed tickers" suggestion
 * list and the reconstructed-day banner). A LOCKED commitment on this
 * date is what makes a review "real" rather than reconstructed — a DRAFT
 * commitment does not count, same reasoning as everywhere else in this
 * app: only a locked plan is a real premarket commitment.
 */
export async function getDailyReviewContext(
  tradeDate: string
): Promise<{ data: DailyReviewContext; error: null } | { data: null; error: string }> {
  try {
    const supabase = getSupabaseAdmin();

    const [{ data: review, error: reviewError }, commitmentResult] = await Promise.all([
      supabase.from("daily_reviews").select("*").eq("trade_date", tradeDate).maybeSingle(),
      getLatestCommitmentForDate(tradeDate),
    ]);

    if (reviewError) {
      console.error("getDailyReviewContext: review lookup failed", reviewError);
      return { data: null, error: "Daily Review konnte nicht geladen werden." };
    }

    if (commitmentResult.error) {
      return { data: null, error: commitmentResult.error };
    }

    const commitment =
      commitmentResult.data && commitmentResult.data.status === "LOCKED" ? commitmentResult.data : null;

    return {
      data: { review: (review as DailyReviewRow | null) ?? null, commitment },
      error: null,
    };
  } catch (e) {
    console.error("getDailyReviewContext failed", e);
    return { data: null, error: "Daily Review konnte nicht geladen werden." };
  }
}

/**
 * Upserts the Daily Review for trade_date (one row per date, overwritten
 * in place — no revision history for the Beta, unlike Commitment).
 * `is_reconstructed` / `commitment_id` are derived server-side from
 * whether a locked commitment actually exists for this date, never
 * trusted from the client, so a historical day can never be silently
 * presented as if a real premarket plan had existed.
 */
export async function upsertDailyReview(
  tradeDate: string,
  input: DailyReviewInput
): Promise<{ data: DailyReviewRow; error: null } | { data: null; error: string }> {
  try {
    const supabase = getSupabaseAdmin();

    const commitmentResult = await getLatestCommitmentForDate(tradeDate);
    if (commitmentResult.error) {
      return { data: null, error: commitmentResult.error };
    }
    const lockedCommitment =
      commitmentResult.data && commitmentResult.data.status === "LOCKED" ? commitmentResult.data : null;

    const { data, error } = await supabase
      .from("daily_reviews")
      .upsert(
        {
          trade_date: tradeDate,
          commitment_id: lockedCommitment?.id ?? null,
          is_reconstructed: lockedCommitment === null,
          ...input,
        },
        { onConflict: "trade_date" }
      )
      .select("*")
      .single();

    if (error || !data) {
      console.error("upsertDailyReview failed", error);
      return { data: null, error: "Daily Review konnte nicht gespeichert werden." };
    }

    return { data: data as DailyReviewRow, error: null };
  } catch (e) {
    console.error("upsertDailyReview failed", e);
    return { data: null, error: "Daily Review konnte nicht gespeichert werden." };
  }
}
