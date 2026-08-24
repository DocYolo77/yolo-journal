"use client";

import { useState, useTransition } from "react";
import { createEntryAction, deleteEntryAction, moveEntryAction, updateEntryAction } from "@/app/lessons-learned/actions";
import type { LessonsLearnedEntryRow, LessonsLearnedKind } from "@/lib/supabase/types";

const inputClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none";

/**
 * Shared card list for the "Lessons Learned" and "Quotes" sections —
 * identical shape (a single short text field), freely editable,
 * deletable, and reorderable (up/down), never treated as a locked rule.
 */
export function EntryList({
  kind,
  entries,
  placeholder,
  compact,
}: {
  kind: LessonsLearnedKind;
  entries: LessonsLearnedEntryRow[];
  placeholder: string;
  compact?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [newContent, setNewContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  function addEntry() {
    const trimmed = newContent.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      const result = await createEntryAction(kind, { title: null, content: trimmed, source_url: null });
      if (result.error) {
        setError(result.error);
        return;
      }
      setNewContent("");
    });
  }

  function beginEdit(entry: LessonsLearnedEntryRow) {
    setEditingId(entry.id);
    setEditContent(entry.content);
  }

  function saveEdit(id: string) {
    const trimmed = editContent.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      const result = await updateEntryAction(id, { title: null, content: trimmed, source_url: null });
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
      const result = await deleteEntryAction(id);
      if (result.error) setError(result.error);
    });
  }

  function move(id: string, direction: "up" | "down") {
    setError(null);
    startTransition(async () => {
      const result = await moveEntryAction(id, direction);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-xs text-negative">{error}</p> : null}

      <div className="flex gap-2">
        <input
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addEntry();
            }
          }}
          placeholder={placeholder}
          className={inputClass}
        />
        <button
          type="button"
          onClick={addEntry}
          disabled={isPending}
          className="shrink-0 rounded-md border border-accent/50 px-3 py-2 text-sm text-accent transition-colors hover:bg-accent/10 disabled:opacity-60"
        >
          Hinzufügen
        </button>
      </div>

      <div className={compact ? "space-y-2" : "space-y-3"}>
        {entries.map((entry, index) => (
          <div
            key={entry.id}
            className={`rounded-md border border-border bg-surface ${compact ? "px-3 py-2" : "p-3"}`}
          >
            {editingId === entry.id ? (
              <div className="space-y-2">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={compact ? 2 : 3}
                  className={inputClass}
                  autoFocus
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
              <div className="flex items-start justify-between gap-3">
                <p className="whitespace-pre-wrap text-sm text-foreground">{entry.content}</p>
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
                    disabled={isPending || index === entries.length - 1}
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
            )}
          </div>
        ))}
        {entries.length === 0 ? <p className="text-sm text-muted-foreground">Noch keine Einträge.</p> : null}
      </div>
    </div>
  );
}
