"use client";

import { useRef, useState, useTransition } from "react";
import { saveCryptoWeeklyReviewAction } from "@/app/crypto/actions";
import type { CryptoWeeklyReviewRow } from "@/lib/supabase/types";

const textareaClass =
  "w-full min-h-24 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none";

export function CryptoWeeklyReviewForm({
  weekStart,
  weekEnd,
  review,
}: {
  weekStart: string;
  weekEnd: string;
  review: CryptoWeeklyReviewRow | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function save() {
    if (!formRef.current) return;
    setError(null);
    setSaved(false);
    const formData = new FormData(formRef.current);
    startTransition(async () => {
      const result = await saveCryptoWeeklyReviewAction(weekStart, weekEnd, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  }

  return (
    <form ref={formRef} className="space-y-4 rounded-md border border-border bg-surface p-4">
      <div>
        <label className="text-xs text-muted-foreground">Was lief gut?</label>
        <textarea name="good" defaultValue={review?.good ?? ""} className={textareaClass} />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Was lief schlecht?</label>
        <textarea name="bad" defaultValue={review?.bad ?? ""} className={textareaClass} />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Was habe ich gelernt?</label>
        <textarea name="learned" defaultValue={review?.learned ?? ""} className={textareaClass} />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Fokus nächste Woche</label>
        <textarea name="focus_next_week" defaultValue={review?.focus_next_week ?? ""} className={textareaClass} />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="rounded-md border border-accent/50 px-3 py-2 text-sm text-accent hover:bg-accent/10 disabled:opacity-60"
        >
          {isPending ? "Speichert…" : "Speichern"}
        </button>
        {error ? <p className="text-xs text-negative">{error}</p> : null}
        {saved && !error ? <p className="text-xs text-positive">Gespeichert.</p> : null}
      </div>
    </form>
  );
}
