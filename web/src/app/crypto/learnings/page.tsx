import { PageHeader } from "@/components/layout/page-header";
import { CryptoLearningList } from "@/components/crypto/learning-list";
import { listCryptoLearnings } from "@/lib/data/crypto-learnings";

export const dynamic = "force-dynamic";

export default async function CryptoLearningsPage() {
  const learnings = await listCryptoLearnings();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Crypto Learnings"
        description="Freie Sammlung ausgewählter Lessons aus einzelnen Trades — keine festen Kategorien, Tags dienen nur zum Filtern."
      />
      {learnings.error ? <p className="text-sm text-negative">{learnings.error}</p> : null}
      <CryptoLearningList entries={learnings.data ?? []} />
    </div>
  );
}
