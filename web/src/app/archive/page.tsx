import { PageHeader } from "@/components/layout/page-header";

export default function ArchivePage() {
  return (
    <div>
      <PageHeader title="Archiv" description="Archiv abgeschlossener Reviews und Reports." />
      <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        Folgt, sobald Daily/Weekly/Monthly Reviews erzeugt werden.
      </div>
    </div>
  );
}
