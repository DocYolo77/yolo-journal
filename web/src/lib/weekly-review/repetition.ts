// Repetition / Problem Loop detection (§12) — scans prior FINAL
// weekly_report_snapshots for guardrail violations and diagnostic
// checks that keep recurring, plus guardrails held clean over a
// stretch of weeks. Runs both for the live DRAFT view and gets frozen
// into the FINAL snapshot at finalization time, same as every other
// aggregated section.

import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { WeeklyEnforcement, WeeklyDiagnosticCheck, WeeklyProblemLoop, WeeklyRepetition, WeeklyReportSnapshotData } from "@/lib/supabase/types";

const LOOKBACK_WEEKS = 6;
const MIN_WEEKS_FOR_PATTERN = 3;
const PATTERN_THRESHOLD = 0.6;

export async function computeWeeklyRepetition(
  currentWeekStart: string,
  current: { enforcement: WeeklyEnforcement; diagnostics: WeeklyDiagnosticCheck[] }
): Promise<WeeklyRepetition> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("weekly_report_snapshots")
      .select("week_start, snapshot")
      .lt("week_start", currentWeekStart)
      .order("week_start", { ascending: false })
      .limit(LOOKBACK_WEEKS);

    if (error) {
      console.error("computeWeeklyRepetition: lookup failed", error);
      return { problem_loops: [], recurring_positives: [] };
    }

    const priorWeeks = ((data ?? []) as { week_start: string; snapshot: WeeklyReportSnapshotData }[]).map(
      (row) => row.snapshot.aggregation
    );
    const allWeeks = [current, ...priorWeeks];

    const problemLoops: WeeklyProblemLoop[] = [];
    const recurringPositives: WeeklyProblemLoop[] = [];

    if (allWeeks.length < MIN_WEEKS_FOR_PATTERN) {
      return { problem_loops: [], recurring_positives: [] };
    }

    const guardrailIds = current.enforcement.guardrails.map((g) => g.guardrail_id);
    for (const id of guardrailIds) {
      const perWeek = allWeeks.map((w) => w.enforcement.guardrails.find((g) => g.guardrail_id === id));
      const label = perWeek.find((g) => g)?.guardrail ?? id;
      const checkedWeeks = perWeek.filter((g): g is NonNullable<typeof g> => Boolean(g) && g!.checked_count > 0);
      if (checkedWeeks.length < MIN_WEEKS_FOR_PATTERN) continue;

      const violatedWeeks = checkedWeeks.filter((g) => g.verletzt_count >= 1).length;
      if (violatedWeeks / checkedWeeks.length >= PATTERN_THRESHOLD) {
        problemLoops.push({
          label: `${label}: Verstöße`,
          weeks_seen: violatedWeeks,
          weeks_checked: checkedWeeks.length,
        });
      } else if (violatedWeeks === 0) {
        recurringPositives.push({
          label: `${label}: ohne Verstoß`,
          weeks_seen: checkedWeeks.length,
          weeks_checked: checkedWeeks.length,
        });
      }
    }

    const checkIds = current.diagnostics.map((d) => d.check_id);
    for (const id of checkIds) {
      const perWeek = allWeeks.map((w) => w.diagnostics.find((d) => d.check_id === id));
      const label = perWeek.find((d) => d)?.label ?? id;
      const computableWeeks = perWeek.filter((d): d is NonNullable<typeof d> => Boolean(d) && d!.triggered !== null);
      if (computableWeeks.length < MIN_WEEKS_FOR_PATTERN) continue;

      const triggeredWeeks = computableWeeks.filter((d) => d.triggered).length;
      if (triggeredWeeks / computableWeeks.length >= PATTERN_THRESHOLD) {
        problemLoops.push({ label, weeks_seen: triggeredWeeks, weeks_checked: computableWeeks.length });
      }
    }

    return { problem_loops: problemLoops, recurring_positives: recurringPositives };
  } catch (e) {
    console.error("computeWeeklyRepetition failed", e);
    return { problem_loops: [], recurring_positives: [] };
  }
}
