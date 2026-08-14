// Finalizes a Weekly Review into an immutable report snapshot — same
// pattern as lib/data/report-snapshot.ts's finalizeDailyReview:
// unique(week_start) plus a pre-check before the (potentially slow,
// multi-table-aggregating) work begins.

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { aggregateWeek, getSourceDailyReportIds } from "@/lib/weekly-review/aggregate";
import { appendAuditEvent } from "@/lib/audit";
import type { WeeklyReportSnapshotData, WeeklyReportSnapshotRow, WeeklyReviewRow } from "@/lib/supabase/types";

export async function finalizeWeeklyReview(
  weekStart: string
): Promise<{ data: WeeklyReportSnapshotRow; error: null } | { data: null; error: string }> {
  try {
    const supabase = getSupabaseAdmin();

    const { data: existingSnapshot, error: existingError } = await supabase
      .from("weekly_report_snapshots")
      .select("id")
      .eq("week_start", weekStart)
      .maybeSingle();

    if (existingError) {
      console.error("finalizeWeeklyReview: existing-snapshot lookup failed", existingError);
      return { data: null, error: "Weekly-Report-Snapshot konnte nicht geprüft werden." };
    }
    if (existingSnapshot) {
      return { data: null, error: "Für diese Woche existiert bereits ein finalisierter Report." };
    }

    const { data: weeklyReviewRow, error: reviewError } = await supabase
      .from("weekly_reviews")
      .select("*")
      .eq("week_start", weekStart)
      .maybeSingle();

    if (reviewError) {
      console.error("finalizeWeeklyReview: weekly_reviews lookup failed", reviewError);
      return { data: null, error: "Weekly Review konnte nicht geladen werden." };
    }
    if (!weeklyReviewRow) {
      return { data: null, error: "Kein Weekly Review für diese Woche vorhanden — zuerst speichern." };
    }

    const review = weeklyReviewRow as WeeklyReviewRow;
    const weekEnd = review.week_end;

    const [aggregation, sourceDailyReportIds] = await Promise.all([
      aggregateWeek(weekStart, weekEnd),
      getSourceDailyReportIds(weekStart, weekEnd),
    ]);

    const snapshot: WeeklyReportSnapshotData = {
      report_schema_version: 1,
      week_start: weekStart,
      week_end: weekEnd,
      created_at: new Date().toISOString(),
      source_daily_report_ids: sourceDailyReportIds,
      aggregation,
      manual: {
        preconditions_note: review.preconditions_note,
        worked: review.worked,
        not_worked: review.not_worked,
        largest_missed_move_comment: review.largest_missed_move_comment,
        continue_doing: review.continue_doing,
        improve: review.improve,
        eliminate: review.eliminate,
        next_week_changes: review.next_week_changes,
        process_grade: review.process_grade,
        process_grade_reason: review.process_grade_reason,
      },
    };

    const { data: inserted, error: insertError } = await supabase
      .from("weekly_report_snapshots")
      .insert({
        weekly_review_id: review.id,
        week_start: weekStart,
        week_end: weekEnd,
        report_schema_version: 1,
        source_daily_report_ids: sourceDailyReportIds,
        snapshot,
      })
      .select("*")
      .single();

    if (insertError || !inserted) {
      console.error("finalizeWeeklyReview: insert failed", insertError);
      return {
        data: null,
        error: `Weekly-Report-Snapshot konnte nicht gespeichert werden.${insertError ? ` (${insertError.message})` : ""}`,
      };
    }

    // Best-effort status sync — the snapshot row is the actual source of
    // truth for "is this finalized" regardless of whether this succeeds.
    const { error: statusError } = await supabase
      .from("weekly_reviews")
      .update({ status: "FINAL", finalized_at: new Date().toISOString() })
      .eq("id", review.id);
    if (statusError) {
      console.error("finalizeWeeklyReview: weekly_reviews status update failed (snapshot already saved)", statusError);
    }

    await appendAuditEvent({
      eventType: "weekly_review_finalized",
      tradeDate: weekStart,
      entityType: "weekly_report_snapshot",
      entityId: inserted.id,
      payload: { weekly_review_id: review.id, week_start: weekStart, week_end: weekEnd },
    });

    return { data: inserted as WeeklyReportSnapshotRow, error: null };
  } catch (e) {
    console.error("finalizeWeeklyReview failed", e);
    const message = e instanceof Error ? e.message : "Weekly Report konnte nicht finalisiert werden.";
    return { data: null, error: message };
  }
}

export async function getWeeklyReportSnapshot(
  weekStart: string
): Promise<{ data: WeeklyReportSnapshotRow | null; error: null } | { data: null; error: string }> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("weekly_report_snapshots")
      .select("*")
      .eq("week_start", weekStart)
      .maybeSingle();

    if (error) {
      console.error("getWeeklyReportSnapshot failed", error);
      return { data: null, error: "Weekly Report konnte nicht geladen werden." };
    }

    return { data: (data as WeeklyReportSnapshotRow | null) ?? null, error: null };
  } catch (e) {
    console.error("getWeeklyReportSnapshot failed", e);
    return { data: null, error: "Weekly Report konnte nicht geladen werden." };
  }
}

/** Used by saveWeeklyReviewAction to refuse edits once finalized. */
export async function hasWeeklyReportSnapshot(weekStart: string): Promise<boolean> {
  const result = await getWeeklyReportSnapshot(weekStart);
  return result.data !== null;
}
