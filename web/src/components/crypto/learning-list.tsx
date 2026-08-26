"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  deleteCryptoLearningAction,
  moveCryptoLearningAction,
  updateCryptoLearningAction,
} from "@/app/crypto/actions";
import type { CryptoLearningRow } from "@/lib/supabase/types";

const inputClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none";

/**
 * Free card collection, deliberately no fixed categories — tags are only
 * for filtering, never a required hierarchy (per spec).
 */
export function CryptoLearningList({ entries }: { entries: CryptoLearningRow[] }) {
  const [isPending, startTransition] = useTransition();
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLesson, setEditLesson] = useState("");
  const [editTags, setEditTags] = useState("");
  const [error, setError] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const entry of entries) for (const tag of entry.tags) set.add(tag);
    return Array.from(set).sort();
  }, [entries]);

  const visibleEntries = activeTag ? entries.filter((e) => e.tags.includes(activeTag)) : entries;

  function beginEdit(entry: CryptoLearningRow) {
    setEditingId(entry.id);
    setEditLesson(entry.lesson);
    setEditTags(entry.tags.join(", "));
  }

  function saveEdit(id: string) {
    const trimmed = editLesson.trim();
    if (!trimmed) return;
    setError(null);
    const formData = new FormData();
    formData.set("lesson", trimmed);
    formData.set("tags", editTags);
    startTransition(async () => {
      const result = await updateCryptoLearningAction(id, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setEditingId(null);
    });
  }

  function remove(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await deleteCryptoLearningAction(id);
      if (result.error) setError(result.error);
    });
  }

  function move(id: string, direction: "up" | "down") {
    setError(null);
    startTransition(async () => {
      const result = await moveCryptoLearningAction(id, direction);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-xs text-negative">{error}</p> : null}

      {allTags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTag(null)}
            className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
              activeTag === null ? "border-accent text-accent" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            Alle
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTag(tag)}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                activeTag === tag ? "border-accent text-accent" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      ) : null}

      <div className="space-y-3">
        {visibleEntries.map((entry, index) => (
          <div key={entry.id} className="rounded-md border border-border bg-surface p-3">
            {editingId === entry.id ? (
              <div className="space-y-2">
                <textarea value={editLesson} onChange={(e) => setEditLesson(e.target.value)} rows={2} className={inputClass} autoFocus />
                <input
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  placeholder="Tags, mit Komma getrennt"
                  className={inputClass}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => saveEdit(entry.id)}
                    disabled={isPending}
                    className="rounded-md border border-accent/50 px-2.5 py-1 text-xs text-accent hover:bg-accent/10 disabled:opacity-60"
                  >
                    Speichern
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-surface-hover"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <p className="whitespace-pre-wrap text-sm text-foreground">{entry.lesson}</p>
                  <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    <button
                      type="button"
                      onClick={() => move(entry.id, "up")}
                      disabled={isPending || index === 0}
                      aria-label="Nach oben"
                      className="rounded px-1.5 py-0.5 hover:bg-surface-hover disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(entry.id, "down")}
                      disabled={isPending || index === visibleEntries.length - 1}
                      aria-label="Nach unten"
                      className="rounded px-1.5 py-0.5 hover:bg-surface-hover disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => beginEdit(entry)}
                      className="rounded px-1.5 py-0.5 hover:bg-surface-hover hover:text-foreground"
                    >
                      Bearbeiten
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(entry.id)}
                      disabled={isPending}
                      className="rounded px-1.5 py-0.5 hover:bg-surface-hover hover:text-negative disabled:opacity-30"
                    >
                      Löschen
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {entry.trade_date ? <span>{entry.trade_date}</span> : null}
                  {entry.coin ? <span>{entry.coin}</span> : null}
                  {entry.trade_id ? (
                    <Link href={`/crypto/${entry.trade_id}`} className="text-accent hover:underline">
                      Zum Trade
                    </Link>
                  ) : null}
                  {entry.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-border px-2 py-0.5">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
        {visibleEntries.length === 0 ? <p className="text-sm text-muted-foreground">Noch keine Learnings.</p> : null}
      </div>
    </div>
  );
}
