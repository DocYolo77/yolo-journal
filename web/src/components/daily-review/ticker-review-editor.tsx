"use client";

import {
  MANAGEMENT_GRADE_OPTIONS,
  RULE_STATUS_OPTIONS,
  SETUP_OPTIONS,
  STRUCTURE_OPTIONS,
  STRUCTURE_RATING_OPTIONS,
  TRIGGER_OPTIONS,
} from "@/lib/validation/daily-review";
import type { TickerReview } from "@/lib/supabase/types";

const inputClass =
  "rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none";

function emptyTickerReview(ticker: string): TickerReview {
  return {
    ticker,
    setup: "",
    trigger: "",
    structure: "",
    structure_rating: "",
    thesis: "",
    intended_stop_logic: "",
    management_intent: "",
    management_grade: "",
    rule_status: "",
    notes: "",
  };
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        <option value="">–</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} className={inputClass} />
    </label>
  );
}

export function TickerReviewEditor({
  value,
  onChange,
  suggestedTickers,
  error,
}: {
  value: TickerReview[];
  onChange: (rows: TickerReview[]) => void;
  suggestedTickers: string[];
  error?: string;
}) {
  const existingTickers = new Set(value.map((r) => r.ticker));
  const addableSuggestions = suggestedTickers.filter((t) => !existingTickers.has(t));

  function updateRow(index: number, patch: Partial<TickerReview>) {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function addTicker(ticker: string) {
    const normalized = ticker.trim().toUpperCase();
    if (!normalized || existingTickers.has(normalized)) return;
    onChange([...value, emptyTickerReview(normalized)]);
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-xs text-negative">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        {addableSuggestions.map((ticker) => (
          <button
            key={ticker}
            type="button"
            onClick={() => addTicker(ticker)}
            className="rounded-full border border-accent/50 px-3 py-1 text-xs text-accent hover:bg-accent/10"
          >
            + {ticker} (committed)
          </button>
        ))}
        <ManualTickerAdd onAdd={addTicker} />
      </div>

      <div className="space-y-3">
        {value.map((row, index) => (
          <div key={row.ticker + index} className="rounded-md border border-border bg-surface p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium text-foreground">{row.ticker}</span>
              <button
                type="button"
                onClick={() => removeRow(index)}
                className="text-xs text-muted-foreground hover:text-negative"
              >
                Entfernen
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <SelectField
                label="Setup"
                value={row.setup}
                onChange={(v) => updateRow(index, { setup: v })}
                options={SETUP_OPTIONS}
              />
              <SelectField
                label="Trigger"
                value={row.trigger}
                onChange={(v) => updateRow(index, { trigger: v })}
                options={TRIGGER_OPTIONS}
              />
              <SelectField
                label="Structure"
                value={row.structure}
                onChange={(v) => updateRow(index, { structure: v })}
                options={STRUCTURE_OPTIONS}
              />
              <SelectField
                label="Structure Rating"
                value={row.structure_rating}
                onChange={(v) => updateRow(index, { structure_rating: v })}
                options={STRUCTURE_RATING_OPTIONS}
              />
              <SelectField
                label="Management Grade"
                value={row.management_grade}
                onChange={(v) => updateRow(index, { management_grade: v })}
                options={MANAGEMENT_GRADE_OPTIONS}
              />
              <SelectField
                label="Rule Status"
                value={row.rule_status}
                onChange={(v) => updateRow(index, { rule_status: v })}
                options={RULE_STATUS_OPTIONS}
              />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <TextField label="Thesis" value={row.thesis} onChange={(v) => updateRow(index, { thesis: v })} />
              <TextField
                label="Intended Stop Logic"
                value={row.intended_stop_logic}
                onChange={(v) => updateRow(index, { intended_stop_logic: v })}
              />
              <TextField
                label="Management Intent"
                value={row.management_intent}
                onChange={(v) => updateRow(index, { management_intent: v })}
              />
              <TextField label="Notes" value={row.notes} onChange={(v) => updateRow(index, { notes: v })} />
            </div>
          </div>
        ))}
        {value.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Ticker erfasst.</p>
        ) : null}
      </div>
    </div>
  );
}

function ManualTickerAdd({ onAdd }: { onAdd: (ticker: string) => void }) {
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const input = form.elements.namedItem("manualTicker") as HTMLInputElement;
        onAdd(input.value);
        input.value = "";
      }}
    >
      <input name="manualTicker" placeholder="Ticker manuell" className={`w-28 ${inputClass}`} />
      <button type="submit" className="text-sm text-accent hover:underline">
        + hinzufügen
      </button>
    </form>
  );
}
