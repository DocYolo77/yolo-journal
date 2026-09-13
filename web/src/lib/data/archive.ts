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
  isoYear: number;
  isoWeek: number;
  selfGrade: string | null;
};

/** Weekly Review rows for the Archiv page — v2 is always editable, there is no DRAFT/FINAL split or snapshot to merge. */
export async function getWeeklyArchiveEntries(): Promise<
  { data: WeeklyArchiveEntry[]; error: null } | { data: null; error: string }
> {
  try {
    const supabase = getSupabaseAdmin();

    const { data: reviews, error } = await supabase
      .from("weekly_reviews")
      .select("week_start, week_end, iso_year, iso_week, self_grade")
      .order("week_start", { ascending: false })
      .limit(LOOKBACK_LIMIT);

    if (error) {
      console.error("getWeeklyArchiveEntries: base lookup failed", error);
      return { data: null, error: "Wochen-Archiv konnte nicht geladen werden." };
    }

    const entries: WeeklyArchiveEntry[] = (reviews ?? []).map((r) => ({
      weekStart: r.week_start as string,
      weekEnd: r.week_end as string,
      isoYear: r.iso_year as number,
      isoWeek: r.iso_week as number,
      selfGrade: r.self_grade as string | null,
    }));

    entries.sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));

    return { data: entries, error: null };
  } catch (e) {
    console.error("getWeeklyArchiveEntries failed", e);
    return { data: null, error: "Wochen-Archiv konnte nicht geladen werden." };
  }
}
