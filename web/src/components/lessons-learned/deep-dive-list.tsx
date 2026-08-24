"use client";

import { useState, useTransition } from "react";
import { createEntryAction, deleteEntryAction, moveEntryAction, updateEntryAction } from "@/app/lessons-learned/actions";
import type { LessonsLearnedEntryRow } from "@/lib/supabase/types";

const inputClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none";

type DraftFields = { title: string; content: string; sourceUrl: string };

const emptyDraft: DraftFields = { title: "", content: "", sourceUrl: "" };

function DraftForm({
  draft,
  onChange,
  onCancel,
  onSave,
  saveLabel,
  saving,
}: {
  draft: DraftFields;
  onChange: (draft: DraftFields) => void;
  onCancel?: () => void;
  onSave: () => void;
  saveLabel: string;
  saving: boolean;
}) {
  return (
    <div className="space-y-2">
      <input
        value={draft.title}
        onChange={(e) => onChange({ ...draft, title: e.target.value })}
        placeholder="Titel"
        className={inputClass}
      />
      <textarea
        value={draft.content}
        onChange={(e) => onChange({ ...draft, content: e.target.value })}
        placeholder="Ausführlicher Text — Thread, Erklärung, eigene Zusammenfassung, Konzept, Kommentar..."
        rows={5}
        className={inputClass}
      />
      <input
        value={draft.sourceUrl}
        onChange={(e) => onChange({ ...draft, sourceUrl: e.target.value })}
        placeholder="Quellen-Link (optional)"
        className={inputClass}
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="rounded-md border border-accent/50 px-2.5 py-1 text-xs text-accent hover:bg-accent/10 disabled:opacity-60"
        >
          {saveLabel}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-surface-hover"
          >
            Abbrechen
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function DeepDiveList({ entries }: { entries: LessonsLearnedEntryRow[] }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newDraft, setNewDraft] = useState<DraftFields>(emptyDraft);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<DraftFields>(emptyDraft);

  function addEntry() {
    const title = newDraft.title.trim();
    const content = newDraft.content.trim();
    if (!title || !content) return;
    setError(null);
    startTransition(async () => {
      const result = await createEntryAction("deep_dive", {
        title,
        content,
        source_url: newDraft.sourceUrl.trim() || null,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setNewDraft(emptyDraft);
    });
  }

  function beginEdit(entry: LessonsLearnedEntryRow) {
    setEditingId(entry.id);
    setEditDraft({ title: entry.title ?? "", content: entry.content, sourceUrl: entry.source_url ?? "" });
  }

  function saveEdit(id: string) {
    const title = editDraft.title.trim();
    const content = editDraft.content.trim();
    if (!title || !content) return;
    setError(null);
    startTransition(async () => {
      const result = await updateEntryAction(id, { title, content, source_url: editDraft.sourceUrl.trim() || null });
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

      <div className="rounded-md border border-dashed border-border p-3">
        <DraftForm draft={newDraft} onChange={setNewDraft} onSave={addEntry} saveLabel="Deep Dive hinzufügen" saving={isPending} />
      </div>

      <div className="space-y-3">
        {entries.map((entry, index) => {
          const isExpanded = expandedId === entry.id;
          const isEditing = editingId === entry.id;
          return (
            <div key={entry.id} className="rounded-md border border-border bg-surface p-3">
              {isEditing ? (
                <DraftForm
                  draft={editDraft}
                  onChange={setEditDraft}
                  onCancel={() => setEditingId(null)}
                  onSave={() => saveEdit(entry.id)}
                  saveLabel="Speichern"
                  saving={isPending}
                />
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                      className="flex-1 text-left text-sm font-medium text-foreground hover:text-accent"
                    >
                      {isExpanded ? "▾ " : "▸ "}
                      {entry.title}
                    </button>
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
                  {isExpanded ? (
                    <div className="mt-3 space-y-2 border-t border-border pt-3">
                      <p className="whitespace-pre-wrap text-sm text-foreground">{entry.content}</p>
                      {entry.source_url ? (
                        <a
                          href={entry.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block text-xs text-accent hover:underline"
                        >
                          Quelle: {entry.source_url}
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          );
        })}
        {entries.length === 0 ? <p className="text-sm text-muted-foreground">Noch keine Deep Dives.</p> : null}
      </div>
    </div>
  );
}
