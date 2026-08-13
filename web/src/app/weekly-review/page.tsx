import { PageHeader } from "@/components/layout/page-header";

export default function WeeklyReviewPage() {
  return (
    <div>
      <PageHeader
        title="Weekly Review"
        description="Preconditions, Balance, Enforcement, diagnostische Checks, Shadow-Log, Setup-Ratings, Pattern-/State-Analyse."
      />
      <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        Baut auf den täglichen Daily Reviews der Woche auf. Folgt nach Daily Review.
      </div>
    </div>
  );
}
