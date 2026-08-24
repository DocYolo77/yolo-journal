import { PageHeader } from "@/components/layout/page-header";
import { listEntriesByKind } from "@/lib/data/lessons-learned";
import { EntryList } from "@/components/lessons-learned/entry-list";
import { DeepDiveList } from "@/components/lessons-learned/deep-dive-list";

export const dynamic = "force-dynamic";

export default async function LessonsLearnedPage() {
  const [lessons, quotes, deepDives] = await Promise.all([
    listEntriesByKind("lesson"),
    listEntriesByKind("quote"),
    listEntriesByKind("deep_dive"),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Lessons Learned"
        description="Persönlicher Trading Learning Hub — kurze Erkenntnisse, Zitate und ausführlichere Deep Dives, langfristig gesammelt und wiederauffindbar."
      />

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Lessons Learned</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Kurze Erkenntnisse aus Videos, Trading-Sessions, Büchern, Tweets oder eigenen Erfahrungen — meist ein bis
            drei Sätze, teils nur ein Stichpunkt oder Mantra. Keine festen Regeln, sondern Gedanken, die du behalten
            und verinnerlichen willst.
          </p>
        </div>
        <EntryList kind="lesson" entries={lessons.data ?? []} placeholder="Neues Learning..." />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Quotes</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Kurze Zitate herausragender Trader oder interessante Aussagen aus Twitter/X, Interviews, Videos oder
            Büchern — kompakt und schnell durchscrollbar.
          </p>
        </div>
        <EntryList kind="quote" entries={quotes.data ?? []} placeholder="Neues Zitat..." compact />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Deep Dives</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Größere und ausführlichere Learnings — längere Tweets/Threads, ausführliche Erklärungen, eigene
            Zusammenfassungen, größere Trading-Konzepte, mit optionalem Quellen-Link. Titel anklicken zum Aufklappen.
          </p>
        </div>
        <DeepDiveList entries={deepDives.data ?? []} />
      </section>
    </div>
  );
}
