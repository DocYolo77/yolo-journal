"use client";

import { useState } from "react";
import {
  ENTRY_TACTIC_OPTIONS,
  EXIT_SETUP_OPTIONS,
  EXIT_TACTIC_OPTIONS,
  MANAGEMENT_GRADE_OPTIONS,
  ORB_ENTRY_TACTICS,
  ORL_RESTRICTED_STOP_OPTIONS,
  RULE_STATUS_OPTIONS,
  SETUP_OPTIONS,
  STOP_PLACEMENT_OPTIONS,
  STRUCTURE_OPTIONS,
  STRUCTURE_RATING_OPTIONS,
} from "@/lib/validation/daily-review";
import type { TickerReview } from "@/lib/supabase/types";

export type TickerChartSvgPair = { dailySvg: string; intradaySvg: string };

const inputClass =
  "rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none";

function emptyTickerReview(ticker: string): TickerReview {
  return {
    ticker,
    setup: "",
    entry_tactic: "",
    stop_placement: "",
    stop_placement_pct: null,
    structure: "",
    structure_rating: "",
    thesis: "",
    management_grade: "",
    rule_status: "",
    notes: "",
    exit_setup: "",
    exit_tactic: "",
  };
}

function availableStopPlacementOptions(entryTactic: string): string[] {
  if (ORB_ENTRY_TACTICS.includes(entryTactic)) return STOP_PLACEMENT_OPTIONS;
  return STOP_PLACEMENT_OPTIONS.filter((o) => !ORL_RESTRICTED_STOP_OPTIONS.includes(o));
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
  chartSvgByTicker,
}: {
  value: TickerReview[];
  onChange: (rows: TickerReview[]) => void;
  suggestedTickers: string[];
  error?: string;
  chartSvgByTicker?: Record<string, TickerChartSvgPair>;
}) {
  const existingTickers = new Set(value.map((r) => r.ticker));
  const addableSuggestions = suggestedTickers.filter((t) => !existingTickers.has(t));

  function updateRow(index: number, patch: Partial<TickerReview>) {
    onChange(
      value.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, ...patch };
        // An ORL stop only makes sense relative to an ORB entry — drop it
        // if the entry tactic no longer qualifies.
        if (
          "entry_tactic" in patch &&
          !ORB_ENTRY_TACTICS.includes(next.entry_tactic) &&
          ORL_RESTRICTED_STOP_OPTIONS.includes(next.stop_placement)
        ) {
          next.stop_placement = "";
        }
        if (next.stop_placement !== "%-Stop") {
          next.stop_placement_pct = null;
        }
        return next;
      })
    );
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
                label="Entry-Taktik"
                value={row.entry_tactic}
                onChange={(v) => updateRow(index, { entry_tactic: v })}
                options={ENTRY_TACTIC_OPTIONS}
              />
              <SelectField
                label="Stop Placement"
                value={row.stop_placement}
                onChange={(v) => updateRow(index, { stop_placement: v })}
                options={availableStopPlacementOptions(row.entry_tactic)}
              />
              {row.stop_placement === "%-Stop" ? (
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  Stop %
                  <input
                    type="number"
                    step="0.1"
                    value={row.stop_placement_pct ?? ""}
                    onChange={(e) =>
                      updateRow(index, {
                        stop_placement_pct: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    className={inputClass}
                  />
                </label>
              ) : null}
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
              <SelectField
                label="Exit Setup"
                value={row.exit_setup}
                onChange={(v) => updateRow(index, { exit_setup: v })}
                options={EXIT_SETUP_OPTIONS}
              />
              <SelectField
                label="Exit Taktik"
                value={row.exit_tactic}
                onChange={(v) => updateRow(index, { exit_tactic: v })}
                options={EXIT_TACTIC_OPTIONS}
              />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <TextField label="Thesis" value={row.thesis} onChange={(v) => updateRow(index, { thesis: v })} />
              <TextField
                label="Outcome D0 / Notes"
                value={row.notes}
                onChange={(v) => updateRow(index, { notes: v })}
              />
            </div>
            {chartSvgByTicker?.[row.ticker] ? (
              <div className="mt-3 space-y-3">
                <ChartSvg svg={chartSvgByTicker[row.ticker].dailySvg} />
                <ChartSvg svg={chartSvgByTicker[row.ticker].intradaySvg} />
              </div>
            ) : null}
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
  const [value, setValue] = useState("");

  function submit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setValue("");
  }

  return (
    // Deliberately not a nested <form> — this sits inside
    // DailyReviewForm's own <form action={formAction}>, and nested
    // forms are invalid HTML that browsers handle inconsistently
    // (native submit firing on the wrong form, unexpected navigation).
    // Same plain div + Enter-to-submit pattern as the operational-todos
    // adder further down this page.
    <div className="flex items-center gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Ticker manuell"
        className={`w-28 ${inputClass}`}
      />
      <button type="button" onClick={submit} className="text-sm text-accent hover:underline">
        + hinzufügen
      </button>
    </div>
  );
}

function ChartSvg({ svg }: { svg: string }) {
  return (
    <div
      className="overflow-x-auto rounded-md border border-border"
      // Server-rendered by page.tsx via the same lib/charts/svg-chart.ts
      // functions the finalized report/PDF use — no user-controlled HTML
      // ever flows through here.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
