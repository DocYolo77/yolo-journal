import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { WeeklyAggregationDisplay } from "@/components/weekly-review/aggregation-display";
import { getWeeklyReportSnapshot } from "@/lib/data/weekly-report-snapshot";
import { isValidTradeDate } from "@/lib/trade-date";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function WeeklyReportPage({ params }: { params: Promise<{ weekStart: string }> }) {
  const { weekStart } = await params;

  if (!isValidTradeDate(weekStart)) {
    return (
      <div>
        <PageHeader title="Weekly Report" description="Ungültiges Datum." />
      </div>
    );
  }

  const result = await getWeeklyReportSnapshot(weekStart);

  if (!result.data) {
    return (
      <div>
        <PageHeader title="Weekly Report" description={weekStart} />
        <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          {result.error ?? "Für diese Woche wurde noch kein Report finalisiert."}{" "}
          <Link href={`/weekly-review?week=${weekStart}`} className="text-accent hover:underline">
            Zum Weekly Review
          </Link>
        </div>
      </div>
    );
  }

  const snapshot = result.data.snapshot;
  const { manual } = snapshot;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Weekly Report — ${snapshot.week_start} – ${snapshot.week_end}`}
        description={`Finalisiert am ${formatDateTime(snapshot.created_at)} · Schema v${snapshot.report_schema_version} · basiert auf ${snapshot.source_daily_report_ids.length} finalisierten Daily Report(s)`}
      />

      <div className="flex flex-wrap gap-3">
        <a
          href={`/reports/weekly/${weekStart}/pdf`}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
        >
          PDF herunterladen
        </a>
        <a
          href={`/reports/weekly/${weekStart}/json`}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
        >
          JSON herunterladen
        </a>
      </div>

      <WeeklyAggregationDisplay aggregation={snapshot.aggregation} />

      <section className="space-y-4 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-foreground">Weekly Interpretation</h2>
        <ManualField label="Preconditions" value={manual.preconditions_note} />
        <ManualField label="Was hat funktioniert?" value={manual.worked} />
        <ManualField label="Was hat nicht funktioniert?" value={manual.not_worked} />
        <ManualField label="Largest Missed Move — Kommentar" value={manual.largest_missed_move_comment} />
        <ManualField label="Weiter so" value={manual.continue_doing} />
        <ManualField label="Verbessern" value={manual.improve} />
        <ManualField label="Eliminieren" value={manual.eliminate} />
        <ManualField label="Konkrete Änderung nächste Woche" value={manual.next_week_changes} />
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-foreground">Process Grade:</span>
          <span className="text-lg font-semibold text-accent">{manual.process_grade ?? "–"}</span>
        </div>
        <ManualField label="Begründung" value={manual.process_grade_reason} />
      </section>
    </div>
  );
}

function ManualField({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      <p className="whitespace-pre-wrap text-sm text-foreground">{value}</p>
    </div>
  );
}
