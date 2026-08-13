import { PageHeader } from "@/components/layout/page-header";

export default function MonthlyReviewPage() {
  return (
    <div>
      <PageHeader
        title="Monthly Review"
        description="Trade Frequency, Win Rate, R-Profit-Factor, Expectancy/R, Elimination Candidates, Prozess-Grade."
      />
      <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        Baut auf den Weekly Reviews des Monats auf. Folgt nach Weekly Review.
      </div>
    </div>
  );
}
