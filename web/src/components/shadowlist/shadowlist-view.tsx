"use client";

import { useRef, useState } from "react";
import type { ShadowlistEntry } from "@/lib/data/shadowlist";
import { exportShadowlistPngAction, updateShadowlistTickerAction } from "@/app/shadowlist/actions";

const DEBOUNCE_MS = 800;

function fmtPct(value: number | null): string {
  if (value === null) return "n/v";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function TickerRow({ entry }: { entry: ShadowlistEntry }) {
  const [taken, setTaken] = useState(entry.taken);
  const [note, setNote] = useState(entry.note ?? "");
  const noteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleTakenToggle() {
    const next = !taken;
    setTaken(next);
    void updateShadowlistTickerAction(entry.id, { taken: next });
  }

  function handleNoteChange(value: string) {
    setNote(value);
    if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
    noteTimerRef.current = setTimeout(() => {
      void updateShadowlistTickerAction(entry.id, { note: value || null });
    }, DEBOUNCE_MS);
  }

  return (
    <div className="rounded-lg border border-border bg-surface/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-lg font-semibold text-foreground">{entry.ticker}</span>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">
            Close <span className="text-foreground">{entry.close?.toFixed(2) ?? "n/v"}</span>
          </span>
          <span className={entry.dayMovePct !== null && entry.dayMovePct < 0 ? "text-negative" : "text-positive"}>
            Tag {fmtPct(entry.dayMovePct)}
          </span>
          <span className={entry.fiveDayMovePct !== null && entry.fiveDayMovePct < 0 ? "text-negative" : "text-positive"}>
            5T {fmtPct(entry.fiveDayMovePct)}
          </span>
        </div>
        <button
          type="button"
          onClick={handleTakenToggle}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            taken ? "border-positive text-positive" : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          {taken ? "Genommen" : "Nicht genommen"}
        </button>
      </div>
      <input
        value={note}
        onChange={(e) => handleNoteChange(e.target.value)}
        placeholder="Notiz (optional)"
        className="mt-3 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-accent focus:outline-none"
      />
    </div>
  );
}

export function ShadowlistView({ tradeDate, entries }: { tradeDate: string; entries: ShadowlistEntry[] }) {
  const [exportState, setExportState] = useState<{ status: "idle" | "loading" | "error"; message?: string }>({ status: "idle" });

  async function handleExportPng() {
    setExportState({ status: "loading" });
    const result = await exportShadowlistPngAction(tradeDate);
    if (result.error || !result.data) {
      setExportState({ status: "error", message: result.error ?? "Export fehlgeschlagen." });
      return;
    }
    const link = document.createElement("a");
    link.href = result.data;
    link.download = `Shadowlist_${tradeDate}.png`;
    link.click();
    setExportState({ status: "idle" });
  }

  if (entries.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
        Keine Watchlist-Ticker für dieses Datum. Ticker werden im Kopf-Block des Daily Reviews hinzugefügt.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {entries.map((entry) => (
          <TickerRow key={entry.id} entry={entry} />
        ))}
      </div>
      <div className="flex items-center justify-end gap-3">
        {exportState.status === "error" ? <span className="text-xs text-negative">{exportState.message}</span> : null}
        <button
          type="button"
          onClick={handleExportPng}
          disabled={exportState.status === "loading"}
          className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:border-accent hover:text-accent disabled:opacity-50"
        >
          {exportState.status === "loading" ? "Exportiert…" : "PNG exportieren (Story-Format)"}
        </button>
      </div>
    </div>
  );
}
