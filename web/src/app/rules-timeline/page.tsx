import { PageHeader } from "@/components/layout/page-header";

export default function RulesTimelinePage() {
  return (
    <div>
      <PageHeader
        title="Rules & Timeline"
        description="Append-only Audit-Timeline von Commitment, Lock, Änderungen, Overrides und Reviews."
      />
      <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        Zeigt später den audit_events-Verlauf chronologisch an. Folgt nach Pre-Market Commitment.
      </div>
    </div>
  );
}
