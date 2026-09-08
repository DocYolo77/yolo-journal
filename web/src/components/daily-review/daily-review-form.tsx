"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, useTransition } from "react";
import type {
  DailyReviewGuardrailRow,
  DailyReviewGuardrailStatus,
  DailyReviewRow,
  DailyReviewTradeRow,
  DailyReviewWatchlistRow,
  DailyReviewWatchlistScope,
} from "@/lib/supabase/types";
import {
  DAILY_REVIEW_GUARDRAILS,
  GUARDRAIL_STATUS_LABELS,
  GUARDRAIL_STATUS_ORDER,
  SHADOW_TEXTS,
  normalizeTicker,
  parseFocusLevel,
  parseOptionalNumber,
} from "@/lib/validation/daily-review";
import {
  addTradeCardAction,
  addWatchlistTickerAction,
  clearGuardrailStatusAction,
  getMarkdownExportAction,
  removeTradeCardAction,
  removeWatchlistTickerAction,
  setGuardrailStatusAction,
  updateReviewFieldsAction,
  updateTradeCardAction,
} from "@/app/daily-review/actions";

// v2 Daily Review — one page, six blocks, autosave every 800ms per
// field, no submit button and no required field but trade_date. See
// CLAUDE.md / the "Umbau-Anweisung v2" spec section 3 for the full
// rationale — this component stores inputs, nothing more.

type SaveStatus = "idle" | "saving" | "saved" | "error";

const SaveStatusContext = createContext<{
  reportSaving: () => void;
  reportDone: (error: string | null) => void;
} | null>(null);

function useReportSave() {
  const ctx = useContext(SaveStatusContext);
  if (!ctx) throw new Error("useReportSave must be used inside DailyReviewForm");
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
  return (
    <span className={`text-xs ${status === "error" ? "text-negative" : "text-muted-foreground"}`}>{label}</span>
  );
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

// Splits a pasted ticker list on whitespace, commas, or semicolons —
// "AAPL, MSFT NVDA" / one-per-line all work — same delimiter set the
// old Commitment watchlist importer used, brought back here since
// pasting a whole list at once was more comfortable than one ticker at
// a time.
function splitTickerList(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((t) => normalizeTicker(t))
    .filter(Boolean);
}

function WatchlistChips({
  reviewId,
  scope,
  items,
  onListChange,
}: {
  reviewId: string;
  scope: DailyReviewWatchlistScope;
  items: DailyReviewWatchlistRow[];
  onListChange: React.Dispatch<React.SetStateAction<DailyReviewWatchlistRow[]>>;
}) {
  const [draft, setDraft] = useState("");
  const [, startTransition] = useTransition();

  function importTickers(raw: string) {
    const existing = new Set(items.map((i) => i.ticker));
    const toAdd: string[] = [];
    for (const ticker of splitTickerList(raw)) {
      if (existing.has(ticker)) continue;
      existing.add(ticker);
      toAdd.push(ticker);
    }
    if (toAdd.length === 0) return;
    setDraft("");
    startTransition(async () => {
      for (const ticker of toAdd) {
        const result = await addWatchlistTickerAction(reviewId, scope, ticker);
        if (result.data) {
          const added = result.data;
          onListChange((prev) => (prev.some((p) => p.ticker === added.ticker) ? prev : [...prev, added]));
        }
      }
    });
  }

  function handleRemove(id: string) {
    onListChange((prev) => prev.filter((item) => item.id !== id));
    startTransition(async () => {
      await removeWatchlistTickerAction(id);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((item) => (
        <span
          key={item.id}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-sm text-foreground"
        >
          {item.ticker}
          <button
            type="button"
            onClick={() => handleRemove(item.id)}
            className="text-muted-foreground hover:text-negative"
            aria-label={`${item.ticker} entfernen`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onPaste={(e) => {
          const pasted = e.clipboardData.getData("text");
          if (/[\s,;]/.test(pasted.trim())) {
            e.preventDefault();
            importTickers(pasted);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            importTickers(draft);
          }
        }}
        onBlur={() => importTickers(draft)}
        placeholder="Ticker(s) einfügen + Enter"
        className="w-28 rounded-full border border-dashed border-border bg-transparent px-3 py-1 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-accent focus:outline-none"
      />
    </div>
  );
}

function TradeCard({
  trade,
  suggestions,
  onUpdate,
  onRemove,
}: {
  trade: DailyReviewTradeRow;
  suggestions: { setup: string[]; trigger_tactic: string[]; stop_logic: string[] };
  onUpdate: (id: string, patch: Partial<DailyReviewTradeRow>) => void;
  onRemove: (id: string) => void;
}) {
  const { reportSaving, reportDone } = useReportSave();
  const timersRef = useRef<Partial<Record<string, ReturnType<typeof setTimeout>>>>({});

  type TradeField = "ticker" | "setup" | "trigger_tactic" | "stop_logic" | "what_happened" | "my_thinking";

  const handleFieldChange = useCallback(
    (field: TradeField, value: string) => {
      const normalized = field === "ticker" ? normalizeTicker(value) : value;
      onUpdate(trade.id, { [field]: normalized } as Partial<DailyReviewTradeRow>);
      const timers = timersRef.current;
      const existing = timers[field];
      if (existing) clearTimeout(existing);
      timers[field] = setTimeout(() => {
        reportSaving();
        void updateTradeCardAction(trade.id, { [field]: normalized }).then((result) => reportDone(result.error));
      }, DEBOUNCE_MS);
    },
    [trade.id, onUpdate, reportSaving, reportDone]
  );

  const tickerHandler = useCallback((value: string) => handleFieldChange("ticker", value), [handleFieldChange]);
  const setupHandler = useCallback((value: string) => handleFieldChange("setup", value), [handleFieldChange]);
  const triggerHandler = useCallback((value: string) => handleFieldChange("trigger_tactic", value), [handleFieldChange]);
  const stopHandler = useCallback((value: string) => handleFieldChange("stop_logic", value), [handleFieldChange]);
  const whatHappenedHandler = useCallback((value: string) => handleFieldChange("what_happened", value), [handleFieldChange]);
  const myThinkingHandler = useCallback((value: string) => handleFieldChange("my_thinking", value), [handleFieldChange]);

  return (
    <div className="space-y-3 rounded-md border border-border bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <input
          defaultValue={trade.ticker}
          onChange={(e) => tickerHandler(e.target.value)}
          placeholder="Ticker"
          className="w-32 rounded-md border border-border bg-surface px-2 py-1 text-sm font-medium uppercase text-foreground focus:border-accent focus:outline-none"
        />
        <button type="button" onClick={() => onRemove(trade.id)} className="text-xs text-muted-foreground hover:text-negative">
          Karte entfernen
        </button>
      </div>

      <Field label="Setup">
        <input
          list={`setup-suggestions-${trade.id}`}
          defaultValue={trade.setup ?? ""}
          onChange={(e) => setupHandler(e.target.value)}
          placeholder={SHADOW_TEXTS.tradeSetup}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-accent focus:outline-none"
        />
        <datalist id={`setup-suggestions-${trade.id}`}>
          {suggestions.setup.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </Field>

      <Field label="Trigger / Taktik">
        <input
          list={`trigger-suggestions-${trade.id}`}
          defaultValue={trade.trigger_tactic ?? ""}
          onChange={(e) => triggerHandler(e.target.value)}
          placeholder={SHADOW_TEXTS.tradeTriggerTactic}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-accent focus:outline-none"
        />
        <datalist id={`trigger-suggestions-${trade.id}`}>
          {suggestions.trigger_tactic.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </Field>

      <Field label="Stop-Logik">
        <input
          list={`stop-suggestions-${trade.id}`}
          defaultValue={trade.stop_logic ?? ""}
          onChange={(e) => stopHandler(e.target.value)}
          placeholder={SHADOW_TEXTS.tradeStopLogic}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-accent focus:outline-none"
        />
        <datalist id={`stop-suggestions-${trade.id}`}>
          {suggestions.stop_logic.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </Field>

      <Field label="Was ist passiert">
        <ShadowTextarea value={trade.what_happened ?? ""} onChange={whatHappenedHandler} placeholder={SHADOW_TEXTS.tradeWhatHappened} />
      </Field>

      <Field label="Meine Denke">
        <ShadowTextarea value={trade.my_thinking ?? ""} onChange={myThinkingHandler} placeholder={SHADOW_TEXTS.tradeMyThinking} />
      </Field>
    </div>
  );
}

function GuardrailRow({
  reviewId,
  guardrailKey,
  label,
  current,
}: {
  reviewId: string;
  guardrailKey: string;
  label: string;
  current: DailyReviewGuardrailRow | undefined;
}) {
  const { reportSaving, reportDone } = useReportSave();
  const [status, setStatus] = useState<DailyReviewGuardrailStatus | null>(current?.status ?? null);
  const [note, setNote] = useState(current?.notes ?? "");
  const [noteOpen, setNoteOpen] = useState(Boolean(current?.notes));
  const noteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleClick(next: DailyReviewGuardrailStatus) {
    if (status === next) {
      // Clicking the active state again resets to empty — the default.
      setStatus(null);
      reportSaving();
      void clearGuardrailStatusAction(reviewId, guardrailKey).then((result) => reportDone(result.error));
      return;
    }
    setStatus(next);
    reportSaving();
    void setGuardrailStatusAction(reviewId, guardrailKey, next, note || null).then((result) => reportDone(result.error));
  }

  function handleNoteChange(value: string) {
    setNote(value);
    if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
    if (!status) return;
    noteTimerRef.current = setTimeout(() => {
      reportSaving();
      void setGuardrailStatusAction(reviewId, guardrailKey, status, value || null).then((result) => reportDone(result.error));
    }, DEBOUNCE_MS);
  }

  return (
    <div className="rounded-md border border-border bg-background p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-foreground">{label}</span>
        <div className="flex flex-wrap gap-1">
          {GUARDRAIL_STATUS_ORDER.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => handleClick(option)}
              className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                status === option
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border text-muted-foreground hover:border-accent/40 hover:text-foreground"
              }`}
            >
              {GUARDRAIL_STATUS_LABELS[option]}
            </button>
          ))}
        </div>
      </div>
      {status ? (
        <div className="mt-2">
          {noteOpen ? (
            <input
              value={note}
              onChange={(e) => handleNoteChange(e.target.value)}
              placeholder="Notiz (optional)"
              className="w-full rounded-md border border-border bg-surface px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground/70 focus:border-accent focus:outline-none"
            />
          ) : (
            <button type="button" onClick={() => setNoteOpen(true)} className="text-xs text-muted-foreground hover:text-foreground">
              + Notiz
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function DailyReviewForm({
  tradeDate,
  review,
  watchlistToday: initialWatchlistToday,
  watchlistNext: initialWatchlistNext,
  trades: initialTrades,
  guardrails: initialGuardrails,
  priorSessionPlanHint,
  tradeFieldSuggestions,
}: {
  tradeDate: string;
  review: DailyReviewRow;
  watchlistToday: DailyReviewWatchlistRow[];
  watchlistNext: DailyReviewWatchlistRow[];
  trades: DailyReviewTradeRow[];
  guardrails: DailyReviewGuardrailRow[];
  priorSessionPlanHint: string | null;
  tradeFieldSuggestions: { setup: string[]; trigger_tactic: string[]; stop_logic: string[] };
}) {
  const saveStatusState = useSaveStatusState();
  const [watchlistToday, setWatchlistToday] = useState(initialWatchlistToday);
  const [watchlistNext, setWatchlistNext] = useState(initialWatchlistNext);
  const [trades, setTrades] = useState(initialTrades);
  const [, startTransition] = useTransition();
  const [markdownState, setMarkdownState] = useState<{ status: "idle" | "loading" | "copied" | "error"; message?: string }>({
    status: "idle",
  });

  const contextValue = useMemo(
    () => ({ reportSaving: saveStatusState.reportSaving, reportDone: saveStatusState.reportDone }),
    [saveStatusState.reportSaving, saveStatusState.reportDone]
  );

  const saveField = useCallback(
    (patch: Parameters<typeof updateReviewFieldsAction>[1]) => updateReviewFieldsAction(review.id, patch),
    [review.id]
  );

  const [riskPct, onRiskPctChange] = useAutosaveNumberWithContext(
    review.risk_pct,
    (value) => saveField({ risk_pct: value }),
    parseOptionalNumber,
    contextValue
  );
  const [rValueUsd, onRValueUsdChange] = useAutosaveNumberWithContext(
    review.r_value_usd,
    (value) => saveField({ r_value_usd: value }),
    parseOptionalNumber,
    contextValue
  );
  const [nlvClose, onNlvCloseChange] = useAutosaveNumberWithContext(
    review.nlv_close,
    (value) => saveField({ nlv_close: value }),
    parseOptionalNumber,
    contextValue
  );
  const [marketContext, onMarketContextChange] = useAutosaveTextWithContext(
    review.market_context ?? "",
    (value) => saveField({ market_context: value || null }),
    contextValue
  );
  const [personalState, onPersonalStateChange] = useAutosaveTextWithContext(
    review.personal_state ?? "",
    (value) => saveField({ personal_state: value || null }),
    contextValue
  );
  const [focusLevel, onFocusLevelChange] = useAutosaveNumberWithContext(
    review.focus_level,
    (value) => saveField({ focus_level: value }),
    parseFocusLevel,
    contextValue
  );
  const [gameplan, onGameplanChange] = useAutosaveTextWithContext(
    review.gameplan ?? "",
    (value) => saveField({ gameplan: value || null }),
    contextValue
  );
  const [whatWentWell, onWhatWentWellChange] = useAutosaveTextWithContext(
    review.what_went_well ?? "",
    (value) => saveField({ what_went_well: value || null }),
    contextValue
  );
  const [whatWentWrong, onWhatWentWrongChange] = useAutosaveTextWithContext(
    review.what_went_wrong ?? "",
    (value) => saveField({ what_went_wrong: value || null }),
    contextValue
  );
  const [whatToImprove, onWhatToImproveChange] = useAutosaveTextWithContext(
    review.what_to_improve ?? "",
    (value) => saveField({ what_to_improve: value || null }),
    contextValue
  );
  const [guardrailsNote, onGuardrailsNoteChange] = useAutosaveTextWithContext(
    review.guardrails_note ?? "",
    (value) => saveField({ guardrails_note: value || null }),
    contextValue
  );
  const [selfGrade, onSelfGradeChange] = useAutosaveTextWithContext(
    review.self_grade ?? "",
    (value) => saveField({ self_grade: value || null }),
    contextValue
  );
  const [nextSessionPlan, onNextSessionPlanChange] = useAutosaveTextWithContext(
    review.next_session_plan ?? "",
    (value) => saveField({ next_session_plan: value || null }),
    contextValue
  );

  function handleAddTradeCard() {
    startTransition(async () => {
      const result = await addTradeCardAction(review.id);
      if (result.data) setTrades((prev) => [...prev, result.data]);
    });
  }

  function handleUpdateTradeCard(id: string, patch: Partial<DailyReviewTradeRow>) {
    setTrades((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function handleRemoveTradeCard(id: string) {
    setTrades((prev) => prev.filter((t) => t.id !== id));
    startTransition(async () => {
      await removeTradeCardAction(id);
    });
  }

  async function handleCopyMarkdown() {
    setMarkdownState({ status: "loading" });
    const result = await getMarkdownExportAction(tradeDate);
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

        <Block title="1 · Kopf">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Risk %">
              <input
                value={riskPct}
                onChange={(e) => onRiskPctChange(e.target.value)}
                placeholder="z.B. 0,5"
                inputMode="decimal"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-accent focus:outline-none"
              />
            </Field>
            <Field label="1R in USD">
              <input
                value={rValueUsd}
                onChange={(e) => onRValueUsdChange(e.target.value)}
                placeholder="z.B. 35"
                inputMode="decimal"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-accent focus:outline-none"
              />
            </Field>
            <Field label="NLV Close (optional)">
              <input
                value={nlvClose}
                onChange={(e) => onNlvCloseChange(e.target.value)}
                placeholder="wird im Gespräch live gezogen"
                inputMode="decimal"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-accent focus:outline-none"
              />
            </Field>
          </div>
          <Field label="Watchlist (heute)">
            <WatchlistChips reviewId={review.id} scope="today" items={watchlistToday} onListChange={setWatchlistToday} />
          </Field>
        </Block>

        <Block title="2 · Kontext">
          <Field label="Marktumgebung">
            <ShadowTextarea value={marketContext} onChange={onMarketContextChange} placeholder={SHADOW_TEXTS.marketContext} />
          </Field>
          <Field label="Persönliche Lage / Mentales">
            <ShadowTextarea value={personalState} onChange={onPersonalStateChange} placeholder={SHADOW_TEXTS.personalState} />
          </Field>
          <Field label="Fokus (1 = Unfokussiert · 5 = Maximale Stärke, halbe Schritte erlaubt)">
            <input
              value={focusLevel}
              onChange={(e) => onFocusLevelChange(e.target.value)}
              placeholder="1–5"
              inputMode="decimal"
              className="w-32 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-accent focus:outline-none"
            />
          </Field>
        </Block>

        <Block title="3 · Gameplan">
          {priorSessionPlanHint ? (
            <p className="rounded-md border border-dashed border-border bg-background px-3 py-2 text-xs text-muted-foreground">
              Dein Plan von gestern Abend: {priorSessionPlanHint}
            </p>
          ) : null}
          <Field label="Was war der Plan">
            <ShadowTextarea value={gameplan} onChange={onGameplanChange} placeholder={SHADOW_TEXTS.gameplan} rows={5} />
          </Field>
        </Block>

        <Block title="4 · Trades">
          <div className="space-y-3">
            {trades.map((trade) => (
              <TradeCard
                key={trade.id}
                trade={trade}
                suggestions={tradeFieldSuggestions}
                onUpdate={handleUpdateTradeCard}
                onRemove={handleRemoveTradeCard}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={handleAddTradeCard}
            className="rounded-md border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground hover:border-accent hover:text-accent"
          >
            + Trade
          </button>
        </Block>

        <Block title="5 · Fazit">
          <Field label="Was lief gut">
            <ShadowTextarea value={whatWentWell} onChange={onWhatWentWellChange} placeholder={SHADOW_TEXTS.whatWentWell} />
          </Field>
          <Field label="Was lief nicht gut">
            <ShadowTextarea value={whatWentWrong} onChange={onWhatWentWrongChange} placeholder={SHADOW_TEXTS.whatWentWrong} />
          </Field>
          <Field label="Was geht besser">
            <ShadowTextarea value={whatToImprove} onChange={onWhatToImproveChange} placeholder={SHADOW_TEXTS.whatToImprove} rows={2} />
          </Field>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Guardrails</label>
            <div className="space-y-1.5">
              {DAILY_REVIEW_GUARDRAILS.map((g) => (
                <GuardrailRow
                  key={g.key}
                  reviewId={review.id}
                  guardrailKey={g.key}
                  label={g.label}
                  current={initialGuardrails.find((row) => row.guardrail_key === g.key)}
                />
              ))}
            </div>
            <div className="mt-2">
              <ShadowTextarea
                value={guardrailsNote}
                onChange={onGuardrailsNoteChange}
                placeholder={SHADOW_TEXTS.guardrailsNote}
                rows={2}
              />
            </div>
          </div>
          <Field label="Self Grade">
            <input
              value={selfGrade}
              onChange={(e) => onSelfGradeChange(e.target.value)}
              placeholder={SHADOW_TEXTS.selfGrade}
              className="w-32 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-accent focus:outline-none"
            />
          </Field>
        </Block>

        <Block title="6 · Ausblick">
          <Field label="Watchlist für morgen">
            <WatchlistChips reviewId={review.id} scope="next" items={watchlistNext} onListChange={setWatchlistNext} />
          </Field>
          <Field label="Plan für die morgige Session">
            <ShadowTextarea value={nextSessionPlan} onChange={onNextSessionPlanChange} placeholder={SHADOW_TEXTS.nextSessionPlan} rows={5} />
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
          <a
            href={`/daily-review/pdf?date=${tradeDate}`}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:border-accent hover:text-accent"
          >
            PDF exportieren
          </a>
        </div>
      </div>
    </SaveStatusContext.Provider>
  );
}

// Helpers used only above — split out so the hooks accept an explicit
// context value instead of relying on the Provider being mounted yet
// (the hooks run once per field at the top of DailyReviewForm, before
// the Provider's children — including this component itself — commit).
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
