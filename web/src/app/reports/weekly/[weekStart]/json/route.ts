import { NextResponse } from "next/server";
import { getWeeklyReportSnapshot } from "@/lib/data/weekly-report-snapshot";
import { isValidTradeDate } from "@/lib/trade-date";

/**
 * The full finalized weekly snapshot, verbatim — never re-aggregated,
 * only what finalizeWeeklyReview() wrote once, at finalization time.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ weekStart: string }> }) {
  const { weekStart } = await params;

  if (!isValidTradeDate(weekStart)) {
    return NextResponse.json({ error: "Ungültiges Datum." }, { status: 400 });
  }

  const result = await getWeeklyReportSnapshot(weekStart);

  if (!result.data) {
    return NextResponse.json({ error: result.error ?? "Kein finalisierter Weekly Report für diese Woche." }, { status: 404 });
  }

  return new NextResponse(JSON.stringify(result.data.snapshot, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="weekly-report-${weekStart}.json"`,
    },
  });
}
