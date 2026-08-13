import { PageHeader } from "@/components/layout/page-header";

export default function AccountsPage() {
  return (
    <div>
      <PageHeader title="Accounts" description="Trading-Accounts verwalten." />
      <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        CRUD für Accounts folgt in Phase 5.
      </div>
    </div>
  );
}
