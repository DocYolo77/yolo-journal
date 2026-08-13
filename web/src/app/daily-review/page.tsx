import { PageHeader } from "@/components/layout/page-header";

export default function DailyReviewPage() {
  return (
    <div>
      <PageHeader
        title="Daily Review"
        description="Daily Review & Coaching Journal — IBKR-Reconcile, Altbestand/Tageskampagne, Charts, Mentalstatus, Self-Grade, HTML und PDF."
      />
      <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        Review gegen den gelockten Premarket-Plan, getrennt bewertet nach Selection, Execution
        und Management. Folgt nach Pre-Market Commitment und Shadowlist.
      </div>
    </div>
  );
}
