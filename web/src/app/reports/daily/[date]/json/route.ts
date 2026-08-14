import { NextResponse } from "next/server";
import { getReportSnapshot } from "@/lib/data/report-snapshot";
import { isValidTradeDate } from "@/lib/trade-date";

/**
 * The full finalized report snapshot, verbatim — this route never
 * re-assembles or re-derives anything, it only returns exactly what
 * finalizeDailyReview() wrote once, at finalization time.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;

  if (!isValidTradeDate(date)) {
    return NextResponse.json({ error: "Ungültiges Datum." }, { status: 400 });
  }

  const result = await getReportSnapshot(date);

  if (!result.data) {
    return NextResponse.json(
      { error: result.error ?? "Kein finalisierter Report für dieses Datum." },
      { status: 404 }
    );
  }

  return new NextResponse(JSON.stringify(result.data.snapshot, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="daily-report-${date}.json"`,
    },
  });
}
