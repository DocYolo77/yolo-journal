import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { getArchiveEntries, getWeeklyArchiveEntries } from "@/lib/data/archive";

export const dynamic = "force-dynamic";

export default async function ArchivePage() {
  const [result, weeklyResult] = await Promise.all([getArchiveEntries(), getWeeklyArchiveEntries()]);

  if (!result.data) {
    return (
      <div>
        <PageHeader title="Archiv" description="Archiv abgeschlossener Reviews und Reports." />
        <p className="rounded-md border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-negative">
          {result.error}
        </p>
      </div>
    );
  }

  const entries = result.data;
  const weeklyEntries = weeklyResult.data ?? [];

  return (
    <div className="space-y-8">
      <PageHeader title="Archiv" description="Alle Tage mit einem Daily Review." />

      {entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          Noch keine Tage vorhanden.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Datum</th>
                <th className="px-4 py-2">Format</th>
                <th className="px-4 py-2">Export</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.tradeDate} className="border-b border-border last:border-0 hover:bg-surface-hover">
                  <td className="px-4 py-2">
                    <Link href={`/daily-review?date=${entry.tradeDate}`} className="font-medium text-accent hover:underline">
                      {entry.tradeDate}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    {entry.isLegacy ? (
                      <span className="inline-flex items-center rounded-full bg-surface-hover px-2 py-0.5 text-xs text-muted-foreground">
                        Legacy (vor dem Umbau)
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-positive/10 px-2 py-0.5 text-xs text-positive">
                        Aktuell
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {entry.isLegacy ? (
                      <span className="text-xs text-muted-foreground">–</span>
                    ) : (
                      <a href={`/daily-review/pdf?date=${entry.tradeDate}`} className="text-xs text-accent hover:underline">
                        PDF
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Weekly Reviews</h2>
        {weeklyEntries.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
            Noch keine Weekly Reviews vorhanden.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Zeitraum</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Process Grade</th>
                  <th className="px-4 py-2">Report</th>
                </tr>
              </thead>
              <tbody>
                {weeklyEntries.map((entry) => (
                  <tr key={entry.weekStart} className="border-b border-border last:border-0 hover:bg-surface-hover">
                    <td className="px-4 py-2">
                      <Link href={`/weekly-review?week=${entry.weekStart}`} className="font-medium text-accent hover:underline">
                        {entry.weekStart} – {entry.weekEnd}
                      </Link>
                      {entry.isFinal ? (
                        <span className="ml-2 inline-flex items-center rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
                          FINAL
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{entry.status}</td>
                    <td className="px-4 py-2 text-foreground">{entry.processGrade ?? "–"}</td>
                    <td className="px-4 py-2">
                      {entry.isFinal ? (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                          <Link href={`/reports/weekly/${entry.weekStart}`} className="text-accent hover:underline">
                            Report öffnen
                          </Link>
                          <a href={`/reports/weekly/${entry.weekStart}/pdf`} className="text-accent hover:underline">
                            PDF
                          </a>
                          <a href={`/reports/weekly/${entry.weekStart}/json`} className="text-accent hover:underline">
                            JSON
                          </a>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">–</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
