import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getDailyReviewData } from "@/lib/data/daily-review";
import { getShadowlistEntries } from "@/lib/data/shadowlist";
import { getDailyChartSeries } from "@/lib/market-data/chart-data";
import { renderDailyChartSvg } from "@/lib/charts/svg-chart";
import { svgToPngDataUri } from "@/lib/reports/rasterize-svg";
import { DailyReviewPdfDocument } from "@/lib/reports/daily-pdf-document";
import { getCurrentTradeDateET, isValidTradeDate } from "@/lib/trade-date";

// sharp + @react-pdf/renderer both need real Node APIs — not available
// on the Edge runtime.
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  const tradeDate = dateParam && isValidTradeDate(dateParam) ? dateParam : getCurrentTradeDateET();

  const dataResult = await getDailyReviewData(tradeDate);
  if (dataResult.error || !dataResult.data) {
    return NextResponse.json({ error: dataResult.error ?? "Daily Review konnte nicht geladen werden." }, { status: 404 });
  }

  try {
    const data = dataResult.data;
    const shadowlist = await getShadowlistEntries(tradeDate, data.watchlist);

    const chartImages = await Promise.all(
      data.watchlist.map(async (item) => {
        const series = await getDailyChartSeries(item.ticker, tradeDate);
        return { ticker: item.ticker, dataUri: await svgToPngDataUri(renderDailyChartSvg(item.ticker, series)) };
      })
    );

    // This is a Route Handler generating a PDF buffer, not a React tree
    // with error boundaries — @react-pdf/renderer's renderToBuffer is
    // itself the thing that can throw (a malformed chart data: URI,
    // for instance), and the surrounding try/catch is exactly how that
    // gets turned into a JSON error response instead of a bare 500.
    // eslint-disable-next-line react-hooks/error-boundaries
    const pdfBuffer = await renderToBuffer(<DailyReviewPdfDocument data={data} shadowlist={shadowlist} chartImages={chartImages} />);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Daily_Review_${tradeDate}.pdf"`,
      },
    });
  } catch (e) {
    console.error("Daily Review PDF generation failed", e);
    const message = e instanceof Error ? e.message : "PDF konnte nicht erzeugt werden.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
