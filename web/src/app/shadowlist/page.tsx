import { PageHeader } from "@/components/layout/page-header";

export default function ShadowlistPage() {
  return (
    <div>
      <PageHeader
        title="Shadowlist"
        description="Stock Selection Audit — vorab ausgewählte Namen getrennt von Execution und Management messen."
      />
      <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        Decision-Layer (genommen/nicht genommen), M5/M15/M30-Shadow-Modell und Committed Focus
        Audit folgen, sobald ein gelocktes Commitment als Grundlage existiert.
      </div>
    </div>
  );
}
