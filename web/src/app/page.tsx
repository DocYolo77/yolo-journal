import { PageHeader } from "@/components/layout/page-header";

const PLACEHOLDER_METRICS = [
  { label: "Trades gesamt" },
  { label: "Offene Trades" },
  { label: "Win Rate" },
  { label: "Net P&L" },
];

export default function DashboardPage() {
  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Überblick über deine Trading-Performance."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLACEHOLDER_METRICS.map((metric) => (
          <div
            key={metric.label}
            className="rounded-lg border border-border bg-surface p-4"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {metric.label}
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">–</p>
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        Kennzahlen werden angezeigt, sobald Trades erfasst wurden (ab Phase
        3, ausgewertet in Phase 7).
      </div>
    </div>
  );
}
