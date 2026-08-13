import { PageHeader } from "@/components/layout/page-header";

export default function TradesPage() {
  return (
    <div>
      <PageHeader
        title="Trades"
        description="Trades erfassen, ansehen und bearbeiten."
      />
      <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        Die Trade-Liste, Neuanlage und Detailseite folgen in Phase 3.
      </div>
    </div>
  );
}
