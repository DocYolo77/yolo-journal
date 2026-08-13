"use client";

export type EpCandidateRow = {
  ticker: string;
  gap8Pct: boolean;
  rvol15: boolean;
  newsTrigger: boolean;
  eventDay: boolean;
  contextNotDefensive: boolean;
  notes: string;
};

const CRITERIA: { key: keyof EpCandidateRow; label: string }[] = [
  { key: "gap8Pct", label: "Gap ≥ 8%" },
  { key: "rvol15", label: "RVOL ≥ 1.5" },
  { key: "newsTrigger", label: "News-Trigger" },
  { key: "eventDay", label: "Event-Day" },
  { key: "contextNotDefensive", label: "Context nicht defensiv" },
];

export function EpCandidatesEditor({
  value,
  onChange,
  watchlistTickers,
  error,
}: {
  value: EpCandidateRow[];
  onChange: (rows: EpCandidateRow[]) => void;
  watchlistTickers: string[];
  error?: string;
}) {
  function updateRow(index: number, patch: Partial<EpCandidateRow>) {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function addRow() {
    onChange([
      ...value,
      {
        ticker: watchlistTickers[0] ?? "",
        gap8Pct: false,
        rvol15: false,
        newsTrigger: false,
        eventDay: false,
        contextNotDefensive: false,
        notes: "",
      },
    ]);
  }

  if (watchlistTickers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        EP-Kandidaten benötigen mindestens einen Watchlist-Ticker (Sektion 5).
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-xs text-negative">{error}</p> : null}

      {value.map((row, index) => (
        <div key={index} className="space-y-2 rounded-md border border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <select
              value={row.ticker}
              onChange={(e) => updateRow(index, { ticker: e.target.value })}
              className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-foreground focus:border-accent focus:outline-none"
            >
              {watchlistTickers.map((ticker) => (
                <option key={ticker} value={ticker}>
                  {ticker}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => removeRow(index)}
              className="text-xs text-muted-foreground hover:text-negative"
            >
              Entfernen
            </button>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-foreground">
            {CRITERIA.map((criterion) => (
              <label key={criterion.key} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={Boolean(row[criterion.key])}
                  onChange={(e) =>
                    updateRow(index, { [criterion.key]: e.target.checked } as Partial<EpCandidateRow>)
                  }
                  className="h-4 w-4 rounded border-border bg-surface accent-accent"
                />
                {criterion.label}
              </label>
            ))}
          </div>
          <input
            type="text"
            value={row.notes}
            onChange={(e) => updateRow(index, { notes: e.target.value })}
            placeholder="Notiz"
            className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
          />
        </div>
      ))}

      <button type="button" onClick={addRow} className="text-sm text-accent hover:underline">
        + EP-Kandidat hinzufügen
      </button>
    </div>
  );
}
