import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { getArchiveEntries } from "@/lib/data/archive";

export const dynamic = "force-dynamic";

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${
        ok ? "bg-positive/10 text-positive" : "bg-surface-hover text-muted-foreground"
      }`}
    >
      {ok ? "✓" : "–"} {label}
    </span>
  );
}

export default async function ArchivePage() {
  const result = await getArchiveEntries();

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

  return (
    <div>
      <PageHeader title="Archiv" description="Alle Tage mit Commitment, Shadowlist oder Daily Review." />

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
                <th className="px-4 py-2">Commitment</th>
                <th className="px-4 py-2">Locked</th>
                <th className="px-4 py-2">Shadowlist</th>
                <th className="px-4 py-2">Daily Review</th>
                <th className="px-4 py-2">Status</th>
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
                    <Badge ok={entry.hasCommitment} label={entry.hasCommitment ? "vorhanden" : "keins"} />
                  </td>
                  <td className="px-4 py-2">
                    <Badge ok={entry.locked} label={entry.locked ? "locked" : "offen"} />
                  </td>
                  <td className="px-4 py-2">
                    <Link href={`/shadowlist?date=${entry.tradeDate}`} className="hover:underline">
                      <Badge ok={entry.hasShadowlist} label={entry.hasShadowlist ? "vorhanden" : "keine"} />
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <Badge ok={entry.hasDailyReview} label={entry.hasDailyReview ? "vorhanden" : "keins"} />
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {entry.reviewStatus ?? "–"}
                    {entry.isReconstructed ? " · reconstructed" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
