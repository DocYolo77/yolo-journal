import { getSupabaseAdmin } from "@/lib/supabase/server";

export type ArchiveEntry = {
  tradeDate: string;
  hasCommitment: boolean;
  locked: boolean;
  hasShadowlist: boolean;
  hasDailyReview: boolean;
  reviewStatus: string | null;
  isReconstructed: boolean;
  isFinal: boolean;
};

const LOOKBACK_LIMIT = 365;

/**
 * Merges commitments / shadowlist_decisions / daily_reviews per
 * trade_date into one list for the Archiv page. Beta-scale: fetches
 * everything within LOOKBACK_LIMIT rows per table and merges in JS —
 * no cross-table SQL join, deliberately simple for a single-user
 * dataset that's a few hundred rows at most.
 */
export async function getArchiveEntries(): Promise<
  { data: ArchiveEntry[]; error: null } | { data: null; error: string }
> {
  try {
    const supabase = getSupabaseAdmin();

    const [
      { data: commitments, error: commitmentsError },
      { data: reviews, error: reviewsError },
      { data: reportSnapshots, error: reportSnapshotsError },
    ] = await Promise.all([
      supabase
        .from("commitments")
        .select("id, trade_date, status, revision")
        .order("trade_date", { ascending: false })
        .order("revision", { ascending: false })
        .limit(LOOKBACK_LIMIT),
      supabase
        .from("daily_reviews")
        .select("trade_date, status, is_reconstructed")
        .order("trade_date", { ascending: false })
        .limit(LOOKBACK_LIMIT),
      supabase
        .from("daily_report_snapshots")
        .select("trade_date")
        .order("trade_date", { ascending: false })
        .limit(LOOKBACK_LIMIT),
    ]);

    if (commitmentsError || reviewsError || reportSnapshotsError) {
      console.error(
        "getArchiveEntries: base lookup failed",
        commitmentsError,
        reviewsError,
        reportSnapshotsError
      );
      return { data: null, error: "Archiv konnte nicht geladen werden." };
    }

    const finalDates = new Set((reportSnapshots ?? []).map((r) => r.trade_date as string));

    const latestCommitmentByDate = new Map<
      string,
      { id: string; status: string; revision: number }
    >();
    for (const row of commitments ?? []) {
      if (!latestCommitmentByDate.has(row.trade_date)) {
        latestCommitmentByDate.set(row.trade_date, { id: row.id, status: row.status, revision: row.revision });
      }
    }

    const commitmentIds = Array.from(latestCommitmentByDate.values()).map((c) => c.id);
    let commitmentIdsWithShadowlist = new Set<string>();

    if (commitmentIds.length > 0) {
      const { data: shadowlistRows, error: shadowlistError } = await supabase
        .from("shadowlist_decisions")
        .select("commitment_id")
        .in("commitment_id", commitmentIds);

      if (shadowlistError) {
        console.error("getArchiveEntries: shadowlist lookup failed", shadowlistError);
        return { data: null, error: "Archiv konnte nicht vollständig geladen werden." };
      }

      commitmentIdsWithShadowlist = new Set((shadowlistRows ?? []).map((r) => r.commitment_id as string));
    }

    const reviewByDate = new Map<string, { status: string; is_reconstructed: boolean }>();
    for (const row of reviews ?? []) {
      reviewByDate.set(row.trade_date, { status: row.status, is_reconstructed: row.is_reconstructed });
    }

    const allDates = new Set<string>([
      ...latestCommitmentByDate.keys(),
      ...reviewByDate.keys(),
      ...finalDates,
    ]);

    const entries: ArchiveEntry[] = Array.from(allDates).map((tradeDate) => {
      const commitment = latestCommitmentByDate.get(tradeDate) ?? null;
      const review = reviewByDate.get(tradeDate) ?? null;

      return {
        tradeDate,
        hasCommitment: commitment !== null,
        locked: commitment?.status === "LOCKED",
        hasShadowlist: commitment !== null && commitmentIdsWithShadowlist.has(commitment.id),
        hasDailyReview: review !== null,
        reviewStatus: review?.status ?? null,
        isReconstructed: review?.is_reconstructed ?? false,
        isFinal: finalDates.has(tradeDate),
      };
    });

    entries.sort((a, b) => (a.tradeDate < b.tradeDate ? 1 : -1));

    return { data: entries, error: null };
  } catch (e) {
    console.error("getArchiveEntries failed", e);
    return { data: null, error: "Archiv konnte nicht geladen werden." };
  }
}
