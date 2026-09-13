"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, useTransition } from "react";
import type {
  WeeklyRegime,
  WeeklyReviewDemonRow,
  WeeklyReviewMissedRow,
  WeeklyReviewRow,
  WeeklyReviewTradeRow,
  WeeklySelfGrade,
} from "@/lib/supabase/types";
import { normalizeTicker, parseFocusLevel } from "@/lib/validation/daily-review";
import {
  WEEKLY_DEMON_ITEMS,
  WEEKLY_MENTAL_TAGS,
  WEEKLY_MISSED_LEITFRAGEN,
  WEEKLY_PROZESS_VS_ERGEBNIS_OPTIONS,
  WEEKLY_REGIME_OPTIONS,
  WEEKLY_SELF_GRADE_OPTIONS,
  WEEKLY_SHADOW_TEXTS,
  WEEKLY_TRADE_GRADE_OPTIONS,
  WEEKLY_TRADE_SEITE_OPTIONS,
} from "@/lib/validation/weekly-review";
import {
  addMissedCardAction,
  addWeeklyTradeCardAction,
  getWeeklyMarkdownExportAction,
  removeMissedCardAction,
  removeWeeklyTradeCardAction,
  setDemonStateAction,
  updateMissedCardAction,
  updateWeeklyReviewFieldsAction,
  updateWeeklyTradeCardAction,
} from "@/app/weekly-review/actions";

// Weekly Review v2 — one page, autosave every 800ms per field, no submit
// button. Same architecture as components/daily-review/daily-review-form.tsx
// (deliberately not shared code — each page owns its own small field
// primitives, matching this codebase's existing convention). Block 6
// (Shadow Log) is a deliberate gap: its number is never rendered here.

type SaveStatus = "idle" | "saving" | "saved" | "error";

const SaveStatusContext = createContext<{
  reportSaving: () => void;
  reportDone: (error: string | null) => void;
} | null>(null);

function useReportSave() {
  const ctx = useContext(SaveStatusContext);
  if (!ctx) throw new Error("useReportSave must be used inside WeeklyReviewForm");
  return ctx;
}

function useSaveStatusState() {
  const [inFlight, setInFlight] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reportSaving = useCallback(() => {
    setLastError(null);
    setInFlight((n) => n + 1);
  }, []);

  const reportDone = useCallback((error: string | null) => {
    setInFlight((n) => Math.max(0, n - 1));
    if (error) {
      setLastError(error);
    } else {
      setJustSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setJustSaved(false), 2000);
    }
  }, []);

  const status: SaveStatus = lastError ? "error" : inFlight > 0 ? "saving" : justSaved ? "saved" : "idle";
  return { status, error: lastError, reportSaving, reportDone };
}

function SaveStatusIndicator({ status, error }: { status: SaveStatus; error: string | null }) {
  if (status === "idle") return <span className="text-xs text-muted-foreground">&nbsp;</span>;
  const label = status === "saving" ? "Speichert…" : status === "error" ? error ?? "Fehler beim Speichern" : "Gespeichert";
  return <span className={`text-xs ${status === "error" ? "text-negative" : "text-muted-foreground"}`}>{label}</span>;
}

const DEBOUNCE_MS = 800;

function ShadowTextarea({
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-accent focus:outline-none"
    />
  );
}

const inputClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-accent focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface/40 p-4">
      <h2 className="mb-3 text-sm font-semibold text-foreground">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function ChartLinkPreview({ url }: { url: string }) {
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline">
      Chart öffnen ↗
    </a>
  );
}

function ToggleYesNo({ value, onChange }: { value: boolean | null; onChange: (next: boolean) => void }) {
  return (
    <div className="flex gap-1">
      {([
        ["Ja", true],
        ["Nein", false],
      ] as const).map(([label, option]) => (
        <button
          key={label}
          type="button"
          onClick={() => onChange(option)}
          className={`rounded-md border px-2 py-1 text-xs transition-colors ${
            value === option
              ? "border-accent bg-accent/10 text-accent"
              : "border-border text-muted-foreground hover:border-accent/40 hover:text-foreground"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// Helpers below accept an explicit context value instead of relying on
// the Provider being mounted yet — same reasoning as
// daily-review-form.tsx's identical helpers.
function useAutosaveTextWithContext(
  initialValue: string,
  save: (value: string) => Promise<{ error: string | null }>,
  ctx: { reportSaving: () => void; reportDone: (error: string | null) => void }
) {
  const [value, setValue] = useState(initialValue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onChange = useCallback(
    (next: string) => {
      setValue(next);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        ctx.reportSaving();
        void save(next).then((result) => ctx.reportDone(result.error));
      }, DEBOUNCE_MS);
    },
    [save, ctx]
  );

  return [value, onChange] as const;
}

function useAutosaveNumberWithContext(
  initialValue: number | null,
  save: (value: number | null) => Promise<{ error: string | null }>,
  parse: (raw: string) => { value: number | null; error?: string },
  ctx: { reportSaving: () => void; reportDone: (error: string | null) => void }
) {
  const [raw, setRaw] = useState(initialValue === null ? "" : String(initialValue));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onChange = useCallback(
    (next: string) => {
      setRaw(next);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const parsed = parse(next);
        ctx.reportSaving();
        if (parsed.error) {
          ctx.reportDone(parsed.error);
          return;
        }
        void save(parsed.value).then((result) => ctx.reportDone(result.error));
      }, DEBOUNCE_MS);
    },
    [save, parse, ctx]
  );

  return [raw, onChange] as const;
}

/** Instant (undebounced) save for discrete clicks — a Ja/Nein toggle where clicking the active option again resets to null. */
function useInstantBooleanWithContext(
  initialValue: boolean | null,
  save: (value: boolean | null) => Promise<{ error: string | null }>,
  ctx: { reportSaving: () => void; reportDone: (error: string | null) => void }
) {
  const [value, setValue] = useState(initialValue);
  const onToggle = useCallback(
    (next: boolean) => {
      const resolved = value === next ? null : next;
      setValue(resolved);
      ctx.reportSaving();
      void save(resolved).then((result) => ctx.reportDone(result.error));
    },
    [value, save, ctx]
  );
  return [value, onToggle] as const;
}

type WeeklyTradeField =
  | "ticker"
  | "seite"
  | "setup"
  | "trigger_tactic"
  | "verlauf"
  | "grade_selektion"
  | "grade_entry"
  | "grade_management"
  | "prozess_vs_ergebnis"
  | "chart_url";

function WeeklyTradeCard({
  trade,
  tickerSuggestions,
  onUpdate,
  onRemove,
}: {
  trade: WeeklyReviewTradeRow;
  tickerSuggestions: string[];
  onUpdate: (id: string, patch: Partial<WeeklyReviewTradeRow>) => void;
  onRemove: (id: string) => void;
}) {
  const { reportSaving, reportDone } = useReportSave();
  const timersRef = useRef<Partial<Record<string, ReturnType<typeof setTimeout>>>>({});

  const handleFieldChange = useCallback(
    (field: WeeklyTradeField, value: string) => {
      const normalized = field === "ticker" ? normalizeTicker(value) : value;
      // Every field but ticker persists "" as null — the enum-select
      // columns (seite/grade_*/prozess_vs_ergebnis) have a check
      // constraint that rejects an empty string outright.
      const patchValue = field === "ticker" ? normalized : normalized || null;
      onUpdate(trade.id, { [field]: patchValue } as Partial<WeeklyReviewTradeRow>);
      const timers = timersRef.current;
      const existing = timers[field];
      if (existing) clearTimeout(existing);
      timers[field] = setTimeout(() => {
        reportSaving();
        void updateWeeklyTradeCardAction(trade.id, { [field]: patchValue }).then((result) => reportDone(result.error));
      }, DEBOUNCE_MS);
    },
    [trade.id, onUpdate, reportSaving, reportDone]
  );

  return (
    <div className="space-y-3 rounded-md border border-border bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <input
          list={`weekly-ticker-suggestions-${trade.id}`}
          defaultValue={trade.ticker}
          onChange={(e) => handleFieldChange("ticker", e.target.value)}
          placeholder="Ticker"
          className="w-32 rounded-md border border-border bg-surface px-2 py-1 text-sm font-medium uppercase text-foreground focus:border-accent focus:outline-none"
        />
        <datalist id={`weekly-ticker-suggestions-${trade.id}`}>
          {tickerSuggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <button type="button" onClick={() => onRemove(trade.id)} className="text-xs text-muted-foreground hover:text-negative">
          Karte entfernen
        </button>
      </div>

      <Field label="Seite">
        <select defaultValue={trade.seite ?? ""} onChange={(e) => handleFieldChange("seite", e.target.value)} className={inputClass}>
          <option value="">—</option>
          {WEEKLY_TRADE_SEITE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Struktur / Setup">
        <input defaultValue={trade.setup ?? ""} onChange={(e) => handleFieldChange("setup", e.target.value)} className={inputClass} />
      </Field>

      <Field label="Trigger / Taktik">
        <input
          defaultValue={trade.trigger_tactic ?? ""}
          onChange={(e) => handleFieldChange("trigger_tactic", e.target.value)}
          className={inputClass}
        />
      </Field>

      <Field label="Was ist passiert (Entry, Adds, Management, Exit)">
        <ShadowTextarea value={trade.verlauf ?? ""} onChange={(v) => handleFieldChange("verlauf", v)} placeholder="" />
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Grade Selektion">
          <select
            defaultValue={trade.grade_selektion ?? ""}
            onChange={(e) => handleFieldChange("grade_selektion", e.target.value)}
            className={inputClass}
          >
            <option value="">—</option>
            {WEEKLY_TRADE_GRADE_OPTIONS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Grade Entry">
          <select
            defaultValue={trade.grade_entry ?? ""}
            onChange={(e) => handleFieldChange("grade_entry", e.target.value)}
            className={inputClass}
          >
            <option value="">—</option>
            {WEEKLY_TRADE_GRADE_OPTIONS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Grade Management">
          <select
            defaultValue={trade.grade_management ?? ""}
            onChange={(e) => handleFieldChange("grade_management", e.target.value)}
            className={inputClass}
          >
            <option value="">—</option>
            {WEEKLY_TRADE_GRADE_OPTIONS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Prozess vs. Ergebnis">
        <select
          defaultValue={trade.prozess_vs_ergebnis ?? ""}
          onChange={(e) => handleFieldChange("prozess_vs_ergebnis", e.target.value)}
          className={inputClass}
        >
          <option value="">—</option>
          {WEEKLY_PROZESS_VS_ERGEBNIS_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Chart-Link">
        <input
          type="url"
          defaultValue={trade.chart_url ?? ""}
          onChange={(e) => handleFieldChange("chart_url", e.target.value)}
          placeholder="https://www.tradingview.com/x/..."
          className={inputClass}
        />
      </Field>
      <ChartLinkPreview url={trade.chart_url ?? ""} />
    </div>
  );
}

type MissedField = "ticker" | "chart_url" | "text";

function MissedCard({
  card,
  tickerSuggestions,
  onUpdate,
  onRemove,
}: {
  card: WeeklyReviewMissedRow;
  tickerSuggestions: string[];
  onUpdate: (id: string, patch: Partial<WeeklyReviewMissedRow>) => void;
  onRemove: (id: string) => void;
}) {
  const { reportSaving, reportDone } = useReportSave();
  const timersRef = useRef<Partial<Record<string, ReturnType<typeof setTimeout>>>>({});

  const handleFieldChange = useCallback(
    (field: MissedField, value: string) => {
      const normalized = field === "ticker" ? normalizeTicker(value) : value;
      const patchValue = field === "ticker" ? normalized : normalized || null;
      onUpdate(card.id, { [field]: patchValue } as Partial<WeeklyReviewMissedRow>);
      const timers = timersRef.current;
      const existing = timers[field];
      if (existing) clearTimeout(existing);
      timers[field] = setTimeout(() => {
        reportSaving();
        void updateMissedCardAction(card.id, { [field]: patchValue }).then((result) => reportDone(result.error));
      }, DEBOUNCE_MS);
    },
    [card.id, onUpdate, reportSaving, reportDone]
  );

  return (
    <div className="space-y-3 rounded-md border border-border bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <input
          list={`missed-ticker-suggestions-${card.id}`}
          defaultValue={card.ticker}
          onChange={(e) => handleFieldChange("ticker", e.target.value)}
          placeholder="Ticker"
          className="w-32 rounded-md border border-border bg-surface px-2 py-1 text-sm font-medium uppercase text-foreground focus:border-accent focus:outline-none"
        />
        <datalist id={`missed-ticker-suggestions-${card.id}`}>
          {tickerSuggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <button type="button" onClick={() => onRemove(card.id)} className="text-xs text-muted-foreground hover:text-negative">
          Karte entfernen
        </button>
      </div>
      <Field label="Chart-Link">
        <input
          type="url"
          defaultValue={card.chart_url ?? ""}
          onChange={(e) => handleFieldChange("chart_url", e.target.value)}
          placeholder="https://www.tradingview.com/x/..."
          className={inputClass}
        />
      </Field>
      <ChartLinkPreview url={card.chart_url ?? ""} />
      <Field label="Text">
        <ShadowTextarea value={card.text ?? ""} onChange={(v) => handleFieldChange("text", v)} placeholder="" />
      </Field>
    </div>
  );
}

function DemonRow({
  reviewId,
  demonKey,
  label,
  current,
  onChange,
}: {
  reviewId: string;
  demonKey: string;
  label: string;
  current: { aktiv: boolean; text: string };
  onChange: (key: string, next: { aktiv: boolean; text: string }) => void;
}) {
  const { reportSaving, reportDone } = useReportSave();
  const textTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function toggleAktiv() {
    const next = { aktiv: !current.aktiv, text: current.text };
    onChange(demonKey, next);
    reportSaving();
    void setDemonStateAction(reviewId, demonKey, next.aktiv, next.text || null).then((result) => reportDone(result.error));
  }

  function handleText(value: string) {
    onChange(demonKey, { aktiv: current.aktiv, text: value });
    if (textTimerRef.current) clearTimeout(textTimerRef.current);
    textTimerRef.current = setTimeout(() => {
      reportSaving();
      void setDemonStateAction(reviewId, demonKey, current.aktiv, value || null).then((result) => reportDone(result.error));
    }, DEBOUNCE_MS);
  }

  return (
    <div className="space-y-2 rounded-md border border-border bg-background p-2.5">
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input type="checkbox" checked={current.aktiv} onChange={toggleAktiv} className="h-4 w-4" />
        {label}
      </label>
      <input value={current.text} onChange={(e) => handleText(e.target.value)} placeholder="Wo / wie" className={inputClass} />
    </div>
  );
}

function RoleRow({
  label,
  value,
  text,
  onValueChange,
  onTextChange,
}: {
  label: string;
  value: boolean | null;
  text: string;
  onValueChange: (next: boolean) => void;
  onTextChange: (next: string) => void;
}) {
  return (
    <div className="space-y-2 rounded-md border border-border bg-background p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-foreground">{label}</span>
        <ToggleYesNo value={value} onChange={onValueChange} />
      </div>
      <input value={text} onChange={(e) => onTextChange(e.target.value)} placeholder={WEEKLY_SHADOW_TEXTS.rolleWarum} className={inputClass} />
    </div>
  );
}

export function WeeklyReviewForm({
  review,
  trades: initialTrades,
  missed: initialMissed,
  demons: initialDemons,
  tickerSuggestions,
}: {
  review: WeeklyReviewRow;
  trades: WeeklyReviewTradeRow[];
  missed: WeeklyReviewMissedRow[];
  demons: WeeklyReviewDemonRow[];
  tickerSuggestions: string[];
}) {
  const saveStatusState = useSaveStatusState();
  const contextValue = useMemo(
    () => ({ reportSaving: saveStatusState.reportSaving, reportDone: saveStatusState.reportDone }),
    [saveStatusState.reportSaving, saveStatusState.reportDone]
  );

  const [trades, setTrades] = useState(initialTrades);
  const [missed, setMissed] = useState(initialMissed);
  const [, startTransition] = useTransition();
  const [markdownState, setMarkdownState] = useState<{ status: "idle" | "loading" | "copied" | "error"; message?: string }>({
    status: "idle",
  });

  const saveField = useCallback(
    (patch: Parameters<typeof updateWeeklyReviewFieldsAction>[1]) => updateWeeklyReviewFieldsAction(review.id, patch),
    [review.id]
  );

  const [demonState, setDemonState] = useState<Record<string, { aktiv: boolean; text: string }>>(() => {
    const map: Record<string, { aktiv: boolean; text: string }> = {};
    for (const item of WEEKLY_DEMON_ITEMS) {
      const row = initialDemons.find((d) => d.demon_key === item.key);
      map[item.key] = { aktiv: row?.aktiv ?? false, text: row?.text ?? "" };
    }
    return map;
  });
  function handleDemonChange(key: string, next: { aktiv: boolean; text: string }) {
    setDemonState((prev) => ({ ...prev, [key]: next }));
  }

  const [mentalTags, setMentalTags] = useState(review.mental_tags);
  function toggleMentalTag(tag: string) {
    const next = mentalTags.includes(tag) ? mentalTags.filter((t) => t !== tag) : [...mentalTags, tag];
    setMentalTags(next);
    saveStatusState.reportSaving();
    void saveField({ mental_tags: next }).then((result) => saveStatusState.reportDone(result.error));
  }

  const [regime, setRegime] = useState<WeeklyRegime | null>(review.regime);
  function handleRegimeChange(value: string) {
    const next = value === "" ? null : (value as WeeklyRegime);
    setRegime(next);
    saveStatusState.reportSaving();
    void saveField({ regime: next }).then((result) => saveStatusState.reportDone(result.error));
  }

  const [selfGrade, setSelfGrade] = useState<WeeklySelfGrade | null>(review.self_grade);
  function handleSelfGradeChange(value: string) {
    const next = value === "" ? null : (value as WeeklySelfGrade);
    setSelfGrade(next);
    saveStatusState.reportSaving();
    void saveField({ self_grade: next }).then((result) => saveStatusState.reportDone(result.error));
  }

  const [brueche, onBruecheChange] = useAutosaveTextWithContext(review.brueche ?? "", (v) => saveField({ brueche: v || null }), contextValue);
  const [biasFlip, onBiasFlipChange] = useInstantBooleanWithContext(review.bias_flip, (v) => saveField({ bias_flip: v }), contextValue);
  const [biasFlipText, onBiasFlipTextChange] = useAutosaveTextWithContext(
    review.bias_flip_text ?? "",
    (v) => saveField({ bias_flip_text: v || null }),
    contextValue
  );
  const [leadership, onLeadershipChange] = useAutosaveTextWithContext(review.leadership ?? "", (v) => saveField({ leadership: v || null }), contextValue);
  const [satzDerWoche, onSatzDerWocheChange] = useAutosaveTextWithContext(
    review.satz_der_woche ?? "",
    (v) => saveField({ satz_der_woche: v || null }),
    contextValue
  );
  const [mentalText, onMentalTextChange] = useAutosaveTextWithContext(review.mental_text ?? "", (v) => saveField({ mental_text: v || null }), contextValue);
  const [fokus, onFokusChange] = useAutosaveNumberWithContext(review.fokus, (v) => saveField({ fokus: v }), parseFocusLevel, contextValue);

  const [staerksteNamen, onStaerksteNamenChange] = useAutosaveTextWithContext(
    review.staerkste_namen ?? "",
    (v) => saveField({ staerkste_namen: v || null }),
    contextValue
  );
  const [gehandelt, onGehandeltChange] = useAutosaveTextWithContext(review.gehandelt ?? "", (v) => saveField({ gehandelt: v || null }), contextValue);
  const [nichtGehandelt, onNichtGehandeltChange] = useAutosaveTextWithContext(
    review.nicht_gehandelt ?? "",
    (v) => saveField({ nicht_gehandelt: v || null }),
    contextValue
  );
  const [verpasst, onVerpasstChange] = useAutosaveTextWithContext(review.verpasst ?? "", (v) => saveField({ verpasst: v || null }), contextValue);
  const [guterSkip, onGuterSkipChange] = useAutosaveTextWithContext(review.guter_skip ?? "", (v) => saveField({ guter_skip: v || null }), contextValue);

  const [gemeinsameEigenschaften, onGemeinsameEigenschaftenChange] = useAutosaveTextWithContext(
    review.gemeinsame_eigenschaften ?? "",
    (v) => saveField({ gemeinsame_eigenschaften: v || null }),
    contextValue
  );

  const [worstTradeTicker, onWorstTradeTickerChange] = useAutosaveTextWithContext(
    review.worst_trade_ticker ?? "",
    (v) => saveField({ worst_trade_ticker: v || null }),
    contextValue
  );
  const [worstTradeText, onWorstTradeTextChange] = useAutosaveTextWithContext(
    review.worst_trade_text ?? "",
    (v) => saveField({ worst_trade_text: v || null }),
    contextValue
  );
  const [wiederholung, onWiederholungChange] = useInstantBooleanWithContext(review.wiederholung, (v) => saveField({ wiederholung: v }), contextValue);
  const [wiederholungText, onWiederholungTextChange] = useAutosaveTextWithContext(
    review.wiederholung_text ?? "",
    (v) => saveField({ wiederholung_text: v || null }),
    contextValue
  );

  const [goodTradeTicker, onGoodTradeTickerChange] = useAutosaveTextWithContext(
    review.good_trade_ticker ?? "",
    (v) => saveField({ good_trade_ticker: v || null }),
    contextValue
  );
  const [goodTradeText, onGoodTradeTextChange] = useAutosaveTextWithContext(
    review.good_trade_text ?? "",
    (v) => saveField({ good_trade_text: v || null }),
    contextValue
  );

  const [rolleStockpicker, onRolleStockpickerChange] = useInstantBooleanWithContext(
    review.rolle_stockpicker_ja_nein,
    (v) => saveField({ rolle_stockpicker_ja_nein: v }),
    contextValue
  );
  const [rolleStockpickerText, onRolleStockpickerTextChange] = useAutosaveTextWithContext(
    review.rolle_stockpicker_text ?? "",
    (v) => saveField({ rolle_stockpicker_text: v || null }),
    contextValue
  );
  const [rolleAllocator, onRolleAllocatorChange] = useInstantBooleanWithContext(
    review.rolle_allocator_ja_nein,
    (v) => saveField({ rolle_allocator_ja_nein: v }),
    contextValue
  );
  const [rolleAllocatorText, onRolleAllocatorTextChange] = useAutosaveTextWithContext(
    review.rolle_allocator_text ?? "",
    (v) => saveField({ rolle_allocator_text: v || null }),
    contextValue
  );
  const [rolleOperator, onRolleOperatorChange] = useInstantBooleanWithContext(
    review.rolle_operator_ja_nein,
    (v) => saveField({ rolle_operator_ja_nein: v }),
    contextValue
  );
  const [rolleOperatorText, onRolleOperatorTextChange] = useAutosaveTextWithContext(
    review.rolle_operator_text ?? "",
    (v) => saveField({ rolle_operator_text: v || null }),
    contextValue
  );
  const [selfGradeBegruendung, onSelfGradeBegruendungChange] = useAutosaveTextWithContext(
    review.self_grade_begruendung ?? "",
    (v) => saveField({ self_grade_begruendung: v || null }),
    contextValue
  );

  const [regel, onRegelChange] = useAutosaveTextWithContext(review.regel ?? "", (v) => saveField({ regel: v || null }), contextValue);
  const [regelKonkret, onRegelKonkretChange] = useAutosaveTextWithContext(
    review.regel_konkret ?? "",
    (v) => saveField({ regel_konkret: v || null }),
    contextValue
  );
  const [regelPruefung, onRegelPruefungChange] = useAutosaveTextWithContext(
    review.regel_pruefung ?? "",
    (v) => saveField({ regel_pruefung: v || null }),
    contextValue
  );
  const [ideaCapture, onIdeaCaptureChange] = useAutosaveTextWithContext(
    review.idea_capture ?? "",
    (v) => saveField({ idea_capture: v || null }),
    contextValue
  );

  function handleAddTradeCard() {
    startTransition(async () => {
      const result = await addWeeklyTradeCardAction(review.id);
      if (result.data) setTrades((prev) => [...prev, result.data]);
    });
  }
  function handleUpdateTradeCard(id: string, patch: Partial<WeeklyReviewTradeRow>) {
    setTrades((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }
  function handleRemoveTradeCard(id: string) {
    setTrades((prev) => prev.filter((t) => t.id !== id));
    startTransition(async () => {
      await removeWeeklyTradeCardAction(id);
    });
  }

  function handleAddMissedCard() {
    startTransition(async () => {
      const result = await addMissedCardAction(review.id);
      if (result.data) setMissed((prev) => [...prev, result.data]);
    });
  }
  function handleUpdateMissedCard(id: string, patch: Partial<WeeklyReviewMissedRow>) {
    setMissed((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }
  function handleRemoveMissedCard(id: string) {
    setMissed((prev) => prev.filter((m) => m.id !== id));
    startTransition(async () => {
      await removeMissedCardAction(id);
    });
  }

  async function handleCopyMarkdown() {
    setMarkdownState({ status: "loading" });
    const result = await getWeeklyMarkdownExportAction(review.week_start, review.week_end);
    if (result.error || !result.data) {
      setMarkdownState({ status: "error", message: result.error ?? "Export fehlgeschlagen." });
      return;
    }
    try {
      await navigator.clipboard.writeText(result.data);
      setMarkdownState({ status: "copied" });
      setTimeout(() => setMarkdownState({ status: "idle" }), 2500);
    } catch {
      setMarkdownState({ status: "error", message: "Zwischenablage nicht verfügbar." });
    }
  }

  return (
    <SaveStatusContext.Provider value={contextValue}>
      <div className="space-y-4">
        <div className="flex items-center justify-end">
          <SaveStatusIndicator status={saveStatusState.status} error={saveStatusState.error} />
        </div>

        <Block title="1 · Zahlen & Guardrails">
          <Field label="Wo habe ich selbst die größten Brüche und Probleme gesehen?">
            <ShadowTextarea value={brueche} onChange={onBruecheChange} placeholder={WEEKLY_SHADOW_TEXTS.bruecke} />
          </Field>
        </Block>

        <Block title="2 · Markt der Woche">
          <Field label="Regime">
            <select value={regime ?? ""} onChange={(e) => handleRegimeChange(e.target.value)} className={inputClass}>
              <option value="">—</option>
              {WEEKLY_REGIME_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex flex-wrap items-end gap-4">
            <Field label="Bias-Flip">
              <ToggleYesNo value={biasFlip} onChange={onBiasFlipChange} />
            </Field>
            <div className="min-w-48 flex-1">
              <input
                value={biasFlipText}
                onChange={(e) => onBiasFlipTextChange(e.target.value)}
                placeholder={WEEKLY_SHADOW_TEXTS.biasFlipText}
                className={inputClass}
              />
            </div>
          </div>
          <Field label="Leadership">
            <input value={leadership} onChange={(e) => onLeadershipChange(e.target.value)} placeholder={WEEKLY_SHADOW_TEXTS.leadership} className={inputClass} />
          </Field>
          <Field label="Satz der Woche">
            <input value={satzDerWoche} onChange={(e) => onSatzDerWocheChange(e.target.value)} className={inputClass} />
          </Field>
        </Block>

        <Block title="3 · Mentaler Zustand">
          <Field label="Tags">
            <div className="flex flex-wrap gap-1.5">
              {WEEKLY_MENTAL_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleMentalTag(tag)}
                  className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                    mentalTags.includes(tag)
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border text-muted-foreground hover:border-accent/40 hover:text-foreground"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Fokus (1 = Unfokussiert · 5 = Maximale Stärke, halbe Schritte erlaubt)">
            <input value={fokus} onChange={(e) => onFokusChange(e.target.value)} placeholder="1–5" inputMode="decimal" className="w-32 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-accent focus:outline-none" />
          </Field>
          <Field label="Hat der Zustand Entscheidungen beeinflusst — wo konkret?">
            <ShadowTextarea value={mentalText} onChange={onMentalTextChange} placeholder={WEEKLY_SHADOW_TEXTS.mentalText} />
          </Field>
        </Block>

        <Block title="4 · Trade-Karten">
          <div className="space-y-3">
            {trades.map((trade) => (
              <WeeklyTradeCard key={trade.id} trade={trade} tickerSuggestions={tickerSuggestions} onUpdate={handleUpdateTradeCard} onRemove={handleRemoveTradeCard} />
            ))}
          </div>
          <button
            type="button"
            onClick={handleAddTradeCard}
            className="rounded-md border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground hover:border-accent hover:text-accent"
          >
            + Ticker hinzufügen
          </button>
        </Block>

        <Block title="5 · Universum & Coverage">
          <Field label="Stärkste Namen (nach Stärke geordnet)">
            <input value={staerksteNamen} onChange={(e) => onStaerksteNamenChange(e.target.value)} placeholder={WEEKLY_SHADOW_TEXTS.staerksteNamen} className={inputClass} />
          </Field>
          <Field label="Gehandelt">
            <input value={gehandelt} onChange={(e) => onGehandeltChange(e.target.value)} placeholder={WEEKLY_SHADOW_TEXTS.gehandelt} className={inputClass} />
          </Field>
          <Field label="Nicht gehandelt">
            <input value={nichtGehandelt} onChange={(e) => onNichtGehandeltChange(e.target.value)} placeholder={WEEKLY_SHADOW_TEXTS.nichtGehandelt} className={inputClass} />
          </Field>
          <Field label="Verpasst">
            <input value={verpasst} onChange={(e) => onVerpasstChange(e.target.value)} placeholder={WEEKLY_SHADOW_TEXTS.verpasst} className={inputClass} />
          </Field>
          <Field label="Guter Skip">
            <input value={guterSkip} onChange={(e) => onGuterSkipChange(e.target.value)} placeholder={WEEKLY_SHADOW_TEXTS.guterSkip} className={inputClass} />
          </Field>
        </Block>

        <Block title="7 · Missed Reviews & A+ Pattern Recognition">
          <p className="text-xs text-muted-foreground">{WEEKLY_MISSED_LEITFRAGEN}</p>
          <div className="space-y-3">
            {missed.map((card) => (
              <MissedCard key={card.id} card={card} tickerSuggestions={tickerSuggestions} onUpdate={handleUpdateMissedCard} onRemove={handleRemoveMissedCard} />
            ))}
          </div>
          <button
            type="button"
            onClick={handleAddMissedCard}
            className="rounded-md border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground hover:border-accent hover:text-accent"
          >
            + Karte hinzufügen
          </button>
          <Field label="Was will ich visuell internalisieren?">
            <ShadowTextarea
              value={gemeinsameEigenschaften}
              onChange={onGemeinsameEigenschaftenChange}
              placeholder={WEEKLY_SHADOW_TEXTS.gemeinsameEigenschaften}
            />
          </Field>
        </Block>

        <Block title="8 · Demon Finder">
          <div className="space-y-2">
            {WEEKLY_DEMON_ITEMS.map((item) => (
              <DemonRow
                key={item.key}
                reviewId={review.id}
                demonKey={item.key}
                label={item.label}
                current={demonState[item.key]}
                onChange={handleDemonChange}
              />
            ))}
          </div>
          <Field label="Worst Trade — Ticker">
            <input
              list="worst-trade-ticker-suggestions"
              value={worstTradeTicker}
              onChange={(e) => onWorstTradeTickerChange(normalizeTicker(e.target.value))}
              className={inputClass}
            />
            <datalist id="worst-trade-ticker-suggestions">
              {tickerSuggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <Field label="Was hätte stattdessen passieren müssen?">
            <ShadowTextarea value={worstTradeText} onChange={onWorstTradeTextChange} placeholder={WEEKLY_SHADOW_TEXTS.worstTradeText} rows={2} />
          </Field>
          <div className="flex flex-wrap items-end gap-4">
            <Field label="Wiederholung">
              <ToggleYesNo value={wiederholung} onChange={onWiederholungChange} />
            </Field>
            <div className="min-w-48 flex-1">
              <input
                value={wiederholungText}
                onChange={(e) => onWiederholungTextChange(e.target.value)}
                placeholder={WEEKLY_SHADOW_TEXTS.wiederholungText}
                className={inputClass}
              />
            </div>
          </div>
        </Block>

        <Block title="9 · Bester Prozess der Woche">
          <Field label="Ticker">
            <input
              list="good-trade-ticker-suggestions"
              value={goodTradeTicker}
              onChange={(e) => onGoodTradeTickerChange(normalizeTicker(e.target.value))}
              className={inputClass}
            />
            <datalist id="good-trade-ticker-suggestions">
              {tickerSuggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <Field label="Was lief außergewöhnlich gut, wovon will ich mehr?">
            <ShadowTextarea value={goodTradeText} onChange={onGoodTradeTextChange} placeholder={WEEKLY_SHADOW_TEXTS.goodTradeText} />
          </Field>
        </Block>

        <Block title="10 · Rollen-Check & Self-Grade">
          <div className="space-y-2">
            <RoleRow
              label="Stock Picker (Selektion/Watchlist)"
              value={rolleStockpicker}
              text={rolleStockpickerText}
              onValueChange={onRolleStockpickerChange}
              onTextChange={onRolleStockpickerTextChange}
            />
            <RoleRow
              label="Allocator (welcher Name bekommt Slot und Size)"
              value={rolleAllocator}
              text={rolleAllocatorText}
              onValueChange={onRolleAllocatorChange}
              onTextChange={onRolleAllocatorTextChange}
            />
            <RoleRow
              label="Operator (Execution/Management)"
              value={rolleOperator}
              text={rolleOperatorText}
              onValueChange={onRolleOperatorChange}
              onTextChange={onRolleOperatorTextChange}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Self Grade">
              <select value={selfGrade ?? ""} onChange={(e) => handleSelfGradeChange(e.target.value)} className={inputClass}>
                <option value="">—</option>
                {WEEKLY_SELF_GRADE_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Begründung">
              <input value={selfGradeBegruendung} onChange={(e) => onSelfGradeBegruendungChange(e.target.value)} className={inputClass} />
            </Field>
          </div>
        </Block>

        <Block title="11 · Die eine Regel für nächste Woche">
          <Field label="Wenn nur EINE Sache besser wird">
            <ShadowTextarea value={regel} onChange={onRegelChange} placeholder={WEEKLY_SHADOW_TEXTS.regel} rows={2} />
          </Field>
          <Field label="Bedingung → Handlung">
            <ShadowTextarea value={regelKonkret} onChange={onRegelKonkretChange} placeholder={WEEKLY_SHADOW_TEXTS.regelKonkret} rows={2} />
          </Field>
          <Field label="Woran erkenne ich nächsten Samstag, dass ich sie umgesetzt habe?">
            <ShadowTextarea value={regelPruefung} onChange={onRegelPruefungChange} placeholder={WEEKLY_SHADOW_TEXTS.regelPruefung} rows={2} />
          </Field>
          <Field label="Übergabe ins Idea Capture">
            <ShadowTextarea value={ideaCapture} onChange={onIdeaCaptureChange} placeholder={WEEKLY_SHADOW_TEXTS.ideaCapture} rows={2} />
          </Field>
        </Block>

        <div className="flex items-center justify-end gap-3 pt-2">
          {markdownState.status === "error" ? <span className="text-xs text-negative">{markdownState.message}</span> : null}
          {markdownState.status === "copied" ? <span className="text-xs text-positive">In Zwischenablage kopiert</span> : null}
          <button
            type="button"
            onClick={handleCopyMarkdown}
            disabled={markdownState.status === "loading"}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:border-accent hover:text-accent disabled:opacity-50"
          >
            Für Claude kopieren
          </button>
        </div>
      </div>
    </SaveStatusContext.Provider>
  );
}
