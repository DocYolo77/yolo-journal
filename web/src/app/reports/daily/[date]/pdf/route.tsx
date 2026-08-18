import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getReportSnapshot } from "@/lib/data/report-snapshot";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { renderDailyChartSvg, renderIntradayChartSvg } from "@/lib/charts/svg-chart";
import { svgToPngDataUri } from "@/lib/reports/rasterize-svg";
import { DailyReportPdfDocument } from "@/lib/reports/pdf-document";
import { isValidTradeDate } from "@/lib/trade-date";

// sharp + @react-pdf/renderer both need real Node APIs — not available
// on the Edge runtime.
export const runtime = "nodejs";

async function uploadToPrivateStorage(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  snapshotId: string,
  date: string,
  pdfBuffer: Buffer
): Promise<void> {
  // Best-effort only, per spec ("optional zusätzlich") — a storage
  // failure must never break the actual PDF download response.
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.some((b) => b.name === "reports")) {
      const { error: createError } = await supabase.storage.createBucket("reports", { public: false });
      if (createError) {
        console.error("PDF storage: bucket creation failed", createError);
        return;
      }
    }

    const path = `daily-reports/${date}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("reports")
      .upload(path, pdfBuffer, { contentType: "application/pdf", upsert: true });

    if (uploadError) {
      console.error("PDF storage: upload failed", uploadError);
      return;
    }

    const { error: updateError } = await supabase
      .from("daily_report_snapshots")
      .update({ pdf_storage_path: path, pdf_generated_at: new Date().toISOString() })
      .eq("id", snapshotId);

    if (updateError) {
      console.error("PDF storage: snapshot row update failed (file is uploaded regardless)", updateError);
    }
  } catch (e) {
    console.error("PDF storage step failed (download still succeeds)", e);
  }
}

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

  const snapshot = result.data.snapshot;

  try {
    const indexCharts = await Promise.all(
      snapshot.market_data.index_context.map(async (idx) => ({
        ticker: idx.ticker,
        dataUri: await svgToPngDataUri(renderDailyChartSvg(idx.ticker, idx.daily)),
      }))
    );

    const tickerCharts = await Promise.all(
      snapshot.market_data.tickers.map(async (t) => ({
        ticker: t.ticker,
        dailyDataUri: await svgToPngDataUri(renderDailyChartSvg(t.ticker, t.daily)),
        intradayDataUri: await svgToPngDataUri(
          renderIntradayChartSvg(t.ticker, t.intraday, t.orb_levels, t.markers, t.intraday_warmup ?? [])
        ),
      }))
    );

    const pdfBuffer = await renderToBuffer(
      <DailyReportPdfDocument snapshot={snapshot} chartImages={{ indexCharts, tickerCharts }} />
    );

    await uploadToPrivateStorage(getSupabaseAdmin(), result.data.id, date, pdfBuffer);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="daily-report-${date}.pdf"`,
      },
    });
  } catch (e) {
    console.error("PDF generation failed", e);
    const message = e instanceof Error ? e.message : "PDF konnte nicht erzeugt werden.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
