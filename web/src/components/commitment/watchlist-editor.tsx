"use client";

import { useState } from "react";
import { WATCHLIST_TYPES } from "@/lib/validation/commitment";

export type WatchlistRow = {
  ticker: string;
  riskPct: string;
  listType: string;
  notes: string;
};

const inputClass =
  "rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none";

export function WatchlistEditor({
  value,
  onChange,
  error,
}: {
  value: WatchlistRow[];
  onChange: (rows: WatchlistRow[]) => void;
  error?: string;
}) {
  const [pasteText, setPasteText] = useState("");

  function updateRow(index: number, patch: Partial<WatchlistRow>) {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function addRow() {
    onChange([...value, { ticker: "", riskPct: "", listType: "Prime", notes: "" }]);
  }

  function importPasted() {
    // "TradingView ticker lists can be pasted and imported as Prime names.
    // The original order is preserved and duplicates are removed."
    const tickers = pasteText
      .split(/[\s,]+/)
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean);

    const existingTickers = new Set(value.map((row) => row.ticker.toUpperCase()));
    const newRows: WatchlistRow[] = [];

    for (const ticker of tickers) {
      if (existingTickers.has(ticker)) continue;
      existingTickers.add(ticker);
      newRows.push({ ticker, riskPct: "", listType: "Prime", notes: "" });
    }

    onChange([...value, ...newRows]);
    setPasteText("");
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder="Ticker-Liste einfügen (Leerzeichen/Komma/Zeilenumbruch) — wird als Prime importiert"
          rows={2}
          className={`flex-1 ${inputClass}`}
        />
        <button
          type="button"
          onClick={importPasted}
          className="shrink-0 self-start rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-surface-hover"
        >
          Importieren
        </button>
      </div>

      {error ? <p className="text-xs text-negative">{error}</p> : null}

      <div className="space-y-2">
        {value.map((row, index) => (
          <div key={index} className="grid grid-cols-[1fr_auto_auto_2fr_auto] items-center gap-2">
            <input
              type="text"
              value={row.ticker}
              onChange={(e) => updateRow(index, { ticker: e.target.value.toUpperCase() })}
              placeholder="Ticker"
              className={inputClass}
            />
            <select
              value={row.listType}
              onChange={(e) => updateRow(index, { listType: e.target.value })}
              className={inputClass}
            >
              {WATCHLIST_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="any"
              value={row.riskPct}
              onChange={(e) => updateRow(index, { riskPct: e.target.value })}
              placeholder="Risk %"
              className={`w-24 ${inputClass}`}
            />
            <input
              type="text"
              value={row.notes}
              onChange={(e) => updateRow(index, { notes: e.target.value })}
              placeholder="Notiz"
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => removeRow(index)}
              className="text-xs text-muted-foreground hover:text-negative"
            >
              Entfernen
            </button>
          </div>
        ))}
      </div>

      <button type="button" onClick={addRow} className="text-sm text-accent hover:underline">
        + Ticker manuell hinzufügen
      </button>
    </div>
  );
}
