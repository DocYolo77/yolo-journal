// Top-level entry point: fetch (I/O) + compute (pure) + repetition
// (I/O, needs prior FINAL weeks) for one Monday-Friday trading week.
// Used both by the live DRAFT page (recomputed on every load) and by
// finalizeWeeklyReview (frozen once into weekly_report_snapshots).

import { fetchWeeklyRawData } from "./fetch";
import { computeWeeklyAggregation } from "./compute";
import { computeWeeklyRepetition } from "./repetition";
import type { WeeklyAggregation } from "@/lib/supabase/types";

export async function aggregateWeek(weekStart: string, weekEnd: string): Promise<WeeklyAggregation> {
  const raw = await fetchWeeklyRawData(weekStart, weekEnd);
  const aggregation = computeWeeklyAggregation(raw);
  aggregation.repetition = await computeWeeklyRepetition(weekStart, {
    enforcement: aggregation.enforcement,
    diagnostics: aggregation.diagnostics,
  });
  return aggregation;
}

export { getSourceDailyReportIds } from "./fetch";
