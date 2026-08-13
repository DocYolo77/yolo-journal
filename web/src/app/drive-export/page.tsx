import { PageHeader } from "@/components/layout/page-header";

export default function DriveExportPage() {
  return (
    <div>
      <PageHeader title="Google Drive Export" description="Export von Reports ins Google Drive." />
      <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        Folgt, sobald Reports (HTML/PDF) aus Daily/Weekly/Monthly Review erzeugt werden.
      </div>
    </div>
  );
}
