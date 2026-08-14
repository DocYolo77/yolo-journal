import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getWeeklyReportSnapshot } from "@/lib/data/weekly-report-snapshot";
import { renderDailyChartSvg, renderNlvChartSvg } from "@/lib/charts/svg-chart";
import { svgToPngDataUri } from "@/lib/reports/rasterize-svg";
import { WeeklyReportPdfDocument } from "@/lib/reports/weekly-pdf-document";
import { isValidTradeDate } from "@/lib/trade-date";

// sharp + @react-pdf/renderer both need real Node APIs — not available
// on the Edge runtime.
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(_request: Request, { params }: { params: Promise<{ weekStart: string }> }) {
  const { weekStart } = await params;

  if (!isValidTradeDate(weekStart)) {
    return NextResponse.json({ error: "Ungültiges Datum." }, { status: 400 });
  }

  const result = await getWeeklyReportSnapshot(weekStart);

  if (!result.data) {
    return NextResponse.json({ error: result.error ?? "Kein finalisierter Weekly Report für diese Woche." }, { status: 404 });
  }

  const snapshot = result.data.snapshot;

  try {
    const [nlvChart, indexCharts] = await Promise.all([
      svgToPngDataUri(renderNlvChartSvg(snapshot.aggregation.balance.nlv_series)),
      Promise.all(
        snapshot.aggregation.preconditions.index_context.map(async (idx) => ({
          ticker: idx.ticker,
          dataUri: await svgToPngDataUri(renderDailyChartSvg(idx.ticker, idx.daily)),
        }))
      ),
    ]);

    const pdfBuffer = await renderToBuffer(<WeeklyReportPdfDocument snapshot={snapshot} chartImages={{ nlvChart, indexCharts }} />);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="weekly-report-${weekStart}.pdf"`,
      },
    });
  } catch (e) {
    console.error("Weekly PDF generation failed", e);
    const message = e instanceof Error ? e.message : "PDF konnte nicht erzeugt werden.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
