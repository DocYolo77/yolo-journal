import { PageHeader } from "@/components/layout/page-header";

export default function JournalPage() {
  return (
    <div>
      <PageHeader
        title="Journal"
        description="Tagesjournal mit Notizen, Mood, Focus und Discipline."
      />
      <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        Die Journal-Ansicht nach Datum folgt in Phase 6.
      </div>
    </div>
  );
}
