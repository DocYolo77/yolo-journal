import { getSupabaseAdmin } from "@/lib/supabase/server";

export type ArchiveEntry = {
  tradeDate: string;
  /** True if this date only has a pre-v2 entry (daily_reviews_legacy) — no row in the new capture-tool daily_reviews yet. */
  isLegacy: boolean;
};

const LOOKBACK_LIMIT = 365;

/**
 * Lists every trade_date with a Daily Review, new (v2 capture-tool
 * schema) or legacy (pre-v2, kept only for Weekly Review — see
 * 20260908000000_v2_capture_tool_rewrite.sql). The old Commitment/
 * Lock/Shadowlist-decision/finalized-report concepts this used to
 * cross-reference are all gone in v2 (commitments/shadowlist_decisions/
 * daily_report_snapshots no longer have a matching UI), so this is now
 * a plain per-date existence list rather than a merge of five tables.
 */
export async function getArchiveEntries(): Promise<
  { data: ArchiveEntry[]; error: null } | { data: null; error: string }
> {
  try {
    const supabase = getSupabaseAdmin();

    const [
      { data: newReviews, error: newError },
      { data: legacyReviews, error: legacyError },
    ] = await Promise.all([
      supabase.from("daily_reviews").select("trade_date").order("trade_date", { ascending: false }).limit(LOOKBACK_LIMIT),
      supabase
        .from("daily_reviews_legacy")
        .select("trade_date")
        .order("trade_date", { ascending: false })
        .limit(LOOKBACK_LIMIT),
    ]);

    if (newError || legacyError) {
      console.error("getArchiveEntries: base lookup failed", newError, legacyError);
      return { data: null, error: "Archiv konnte nicht geladen werden." };
    }

    const newDates = new Set((newReviews ?? []).map((r) => r.trade_date as string));
    const legacyDates = new Set((legacyReviews ?? []).map((r) => r.trade_date as string));
    const allDates = new Set<string>([...newDates, ...legacyDates]);

    const entries: ArchiveEntry[] = Array.from(allDates).map((tradeDate) => ({
      tradeDate,
      isLegacy: !newDates.has(tradeDate),
    }));

    entries.sort((a, b) => (a.tradeDate < b.tradeDate ? 1 : -1));

    return { data: entries, error: null };
  } catch (e) {
    console.error("getArchiveEntries failed", e);
    return { data: null, error: "Archiv konnte nicht geladen werden." };
  }
}

export type WeeklyArchiveEntry = {
  weekStart: string;
  weekEnd: string;
  status: string;
  isFinal: boolean;
  processGrade: string | null;
};

/** Weekly Review rows for the Archiv page — merges weekly_reviews (DRAFT/FINAL) with weekly_report_snapshots (FINAL only). */
export async function getWeeklyArchiveEntries(): Promise<
  { data: WeeklyArchiveEntry[]; error: null } | { data: null; error: string }
> {
  try {
    const supabase = getSupabaseAdmin();

    const [{ data: reviews, error: reviewsError }, { data: snapshots, error: snapshotsError }] = await Promise.all([
      supabase
        .from("weekly_reviews")
        .select("week_start, week_end, status")
        .order("week_start", { ascending: false })
        .limit(LOOKBACK_LIMIT),
      supabase
        .from("weekly_report_snapshots")
        .select("week_start, snapshot")
        .order("week_start", { ascending: false })
        .limit(LOOKBACK_LIMIT),
    ]);

    if (reviewsError || snapshotsError) {
      console.error("getWeeklyArchiveEntries: base lookup failed", reviewsError, snapshotsError);
      return { data: null, error: "Wochen-Archiv konnte nicht geladen werden." };
    }

    const finalByWeekStart = new Map<string, string | null>();
    for (const row of snapshots ?? []) {
      const snapshot = row.snapshot as { manual?: { process_grade?: string | null } };
      finalByWeekStart.set(row.week_start as string, snapshot.manual?.process_grade ?? null);
    }

    const entries: WeeklyArchiveEntry[] = (reviews ?? []).map((r) => ({
      weekStart: r.week_start as string,
      weekEnd: r.week_end as string,
      status: r.status as string,
      isFinal: finalByWeekStart.has(r.week_start as string),
      processGrade: finalByWeekStart.get(r.week_start as string) ?? null,
    }));

    entries.sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));

    return { data: entries, error: null };
  } catch (e) {
    console.error("getWeeklyArchiveEntries failed", e);
    return { data: null, error: "Wochen-Archiv konnte nicht geladen werden." };
  }
}
