import { PageHeader } from "@/components/layout/page-header";

export default function StrategiesPage() {
  return (
    <div>
      <PageHeader
        title="Strategies"
        description="Handelsstrategien verwalten."
      />
      <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        CRUD für Strategien folgt in Phase 5.
      </div>
    </div>
  );
}
