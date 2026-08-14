"use client";

import { useActionState, useState, type ReactNode } from "react";
import { FieldNumber, FieldSelect, FieldText, FieldTextarea } from "@/components/ui/form-fields";
import { TickerReviewEditor } from "./ticker-review-editor";
import type { DailyReviewRow, GuardrailEntry, MentalStatus, TickerReview } from "@/lib/supabase/types";
import type { PortfolioPosition } from "@/lib/data/portfolio";
import { formatCurrency, formatDateTime } from "@/lib/format";
import {
  CANONICAL_GUARDRAILS,
  GUARDRAIL_STATUSES,
  MENTAL_STATE_OPTIONS,
  REVIEW_TYPES,
  emptyDailyReviewFormState,
  type DailyReviewFormState,
} from "@/lib/validation/daily-review";

const inputClass =
  "rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none";

function defaultGuardrails(existing: GuardrailEntry[] | undefined): GuardrailEntry[] {
  const byId = new Map((existing ?? []).map((g) => [g.guardrail_id, g]));
  return CANONICAL_GUARDRAILS.map((c) => {
    const found = byId.get(c.id);
    return {
      guardrail_id: c.id,
      guardrail: c.label,
      // Pre-marked "Eingehalten" — the "Guardrails geprüft?" checkbox
      // below is the actual confirmation gate, not this status.
      status: found?.status || "Eingehalten",
      comment: found?.comment ?? "",
    };
  });
}

function defaultMental(existing: MentalStatus | undefined): MentalStatus {
  return {
    states: existing?.states ?? [],
    other_state: existing?.other_state ?? "",
    focus: existing?.focus ?? null,
    influence_note: existing?.influence_note ?? "",
  };
}

export function DailyReviewForm({
  action,
  tradeDate,
  review,
  suggestedTickers,
  portfolio,
  portfolioCapturedAt,
}: {
  action: (state: DailyReviewFormState, formData: FormData) => Promise<DailyReviewFormState>;
  tradeDate: string;
  review: DailyReviewRow | null;
  suggestedTickers: string[];
  portfolio: PortfolioPosition[];
  portfolioCapturedAt: string | null;
}) {
  const [state, formAction, pending] = useActionState(action, emptyDailyReviewFormState);

  const [guardrails, setGuardrails] = useState<GuardrailEntry[]>(() => defaultGuardrails(review?.guardrails));
  const [guardrailsReviewed, setGuardrailsReviewed] = useState(review?.guardrails_reviewed ?? false);
  const [mental, setMental] = useState<MentalStatus>(() => defaultMental(review?.mental));
  const [todos, setTodos] = useState<string[]>(() => review?.operational_todos ?? []);
  const [newTodo, setNewTodo] = useState("");
  const [tickerReviews, setTickerReviews] = useState<TickerReview[]>(() => review?.ticker_reviews ?? []);

  const errors = state.fieldErrors;

  function toggleMentalState(state: string) {
    setMental((m) => ({
      ...m,
      states: m.states.includes(state) ? m.states.filter((s) => s !== state) : [...m.states, state],
    }));
  }

  function addTodo() {
    const trimmed = newTodo.trim();
    if (!trimmed) return;
    setTodos((t) => [...t, trimmed]);
    setNewTodo("");
  }

  return (
    <form action={formAction} className="space-y-6">
      {state.formError ? (
        <p className="rounded-md border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-negative">
          {state.formError}
        </p>
      ) : null}
      {state.success ? (
        <p className="rounded-md border border-positive/40 bg-positive/10 px-3 py-2 text-sm text-positive">
          Gespeichert.
        </p>
      ) : null}

      <input type="hidden" name="guardrailsJson" value={JSON.stringify(guardrails)} readOnly />
      <input type="hidden" name="guardrailsReviewed" value={guardrailsReviewed ? "true" : "false"} readOnly />
      <input type="hidden" name="mentalJson" value={JSON.stringify(mental)} readOnly />
      <input type="hidden" name="operationalTodosJson" value={JSON.stringify(todos)} readOnly />
      <input type="hidden" name="tickerReviewsJson" value={JSON.stringify(tickerReviews)} readOnly />

      <Section title="Tagesdaten">
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldSelect
            name="reviewType"
            label="Review Type"
            defaultValue={review?.review_type ?? undefined}
            options={REVIEW_TYPES.map((t) => ({ value: t, label: t }))}
            placeholder="Bitte wählen"
          />
          <FieldSelect
            name="status"
            label="Status"
            defaultValue={review?.status ?? "DRAFT"}
            options={[
              { value: "DRAFT", label: "Draft" },
              { value: "COMPLETED", label: "Completed" },
            ]}
            placeholder="Bitte wählen"
          />
          <FieldNumber
            name="netLiquidationValue"
            label="NLV / Portfolio Value"
            defaultValue={review?.net_liquidation_value != null ? String(review.net_liquidation_value) : ""}
            error={errors.netLiquidationValue}
          />
          <FieldNumber
            name="dailyPnl"
            label="Daily P&L (optional)"
            defaultValue={review?.daily_pnl != null ? String(review.daily_pnl) : ""}
            error={errors.dailyPnl}
          />
        </div>
        <FieldTextarea
          name="marketThought"
          label="Sessionverlauf und Marktgedanke"
          defaultValue={review?.market_thought ?? ""}
        />
        <FieldTextarea
          name="marketEnvironment"
          label="Marktumgebung"
          defaultValue={review?.market_environment ?? ""}
        />
      </Section>

      <Section title="Portfolio">
        {portfolio.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4">Ticker</th>
                  <th className="py-2 pr-4">Einstiegspreis</th>
                  <th className="py-2 pr-4">Stückzahl</th>
                  <th className="py-2 pr-4">PNL %</th>
                  <th className="py-2 pr-4">PNL $</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {portfolio.map((p) => {
                  const pnlPct =
                    p.average_price && p.market_price
                      ? ((p.market_price - p.average_price) / p.average_price) * 100
                      : null;
                  return (
                    <tr key={p.symbol}>
                      <td className="py-2 pr-4 font-medium text-foreground">{p.symbol}</td>
                      <td className="py-2 pr-4 text-foreground">{formatCurrency(p.average_price, p.currency ?? "USD")}</td>
                      <td className="py-2 pr-4 text-foreground">{p.quantity}</td>
                      <td className={`py-2 pr-4 ${pnlPct != null && pnlPct < 0 ? "text-negative" : "text-positive"}`}>
                        {pnlPct != null ? `${pnlPct.toFixed(2)}%` : "–"}
                      </td>
                      <td
                        className={`py-2 pr-4 ${p.unrealized_pnl != null && p.unrealized_pnl < 0 ? "text-negative" : "text-positive"}`}
                      >
                        {formatCurrency(p.unrealized_pnl, p.currency ?? "USD")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {portfolioCapturedAt ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Stand: {formatDateTime(portfolioCapturedAt)} (letzter IBKR-Sync — unabhängig vom Review-Datum)
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Noch kein Portfolio synchronisiert — siehe &bdquo;Sync IBKR now&rdquo; auf der Shadowlist-Seite.
          </p>
        )}
      </Section>

      <Section title="Ticker Reviews">
        <TickerReviewEditor
          value={tickerReviews}
          onChange={setTickerReviews}
          suggestedTickers={suggestedTickers}
          error={errors.tickerReviews}
        />
      </Section>

      <Section title="Guardrails">
        <div className="space-y-2">
          {guardrails.map((g, index) => (
            <div key={g.guardrail_id} className="grid gap-2 rounded-md border border-border bg-surface p-3 sm:grid-cols-[2fr_1fr_2fr]">
              <span className="text-sm text-foreground">{g.guardrail}</span>
              <select
                value={g.status}
                onChange={(e) =>
                  setGuardrails((prev) =>
                    prev.map((row, i) => (i === index ? { ...row, status: e.target.value as GuardrailEntry["status"] } : row))
                  )
                }
                className={inputClass}
              >
                <option value="">–</option>
                {GUARDRAIL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={g.comment}
                onChange={(e) =>
                  setGuardrails((prev) => prev.map((row, i) => (i === index ? { ...row, comment: e.target.value } : row)))
                }
                placeholder="Kommentar"
                className={inputClass}
              />
            </div>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <input
            type="checkbox"
            checked={guardrailsReviewed}
            onChange={(e) => setGuardrailsReviewed(e.target.checked)}
          />
          Guardrails geprüft?
        </label>
        {!guardrailsReviewed ? (
          <p className="text-xs text-muted-foreground">
            Muss angekreuzt und gespeichert sein, bevor der Review abgeschlossen werden kann.
          </p>
        ) : null}
      </Section>

      <Section title="Mental">
        <div className="flex flex-wrap gap-2">
          {MENTAL_STATE_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleMentalState(s)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                mental.states.includes(s)
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border text-muted-foreground hover:bg-surface-hover"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        {mental.states.includes("Sonstiges") ? (
          <input
            type="text"
            value={mental.other_state}
            onChange={(e) => setMental((m) => ({ ...m, other_state: e.target.value }))}
            placeholder="Sonstiger Zustand"
            className={inputClass}
          />
        ) : null}
        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground sm:max-w-xs">
          Focus (1–5)
          <select
            value={mental.focus ?? ""}
            onChange={(e) => setMental((m) => ({ ...m, focus: e.target.value ? Number(e.target.value) : null }))}
            className={inputClass}
          >
            <option value="">–</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          {errors.mentalFocus ? <span className="text-xs text-negative">{errors.mentalFocus}</span> : null}
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
          Note
          <textarea
            value={mental.influence_note}
            onChange={(e) => setMental((m) => ({ ...m, influence_note: e.target.value }))}
            rows={3}
            className={inputClass}
          />
        </label>
      </Section>

      <Section title="Shadowlist">
        <FieldTextarea
          name="shadowlistComment"
          label="Stellungnahme zur Shadowlist (optional)"
          placeholder="Warum wurden bestimmte Werte nicht genommen?"
          defaultValue={review?.shadowlist_comment ?? ""}
        />
      </Section>

      <Section title="Abschluss">
        <FieldTextarea name="positive" label="Positive" defaultValue={review?.positive ?? ""} />
        <FieldTextarea name="weakness" label="Weakness" defaultValue={review?.weakness ?? ""} />
        <FieldTextarea name="coachingTake" label="Coaching Take" defaultValue={review?.coaching_take ?? ""} />
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldText name="selfGrade" label="Self Grade" defaultValue={review?.self_grade ?? ""} />
          <FieldText name="gradeReason" label="Grade Reason" defaultValue={review?.grade_reason ?? ""} />
        </div>
        <div className="space-y-2">
          <span className="text-sm font-medium text-foreground">Was willst du konkret verbessern?</span>
          <div className="flex gap-2">
            <input
              type="text"
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTodo();
                }
              }}
              placeholder="Verbesserung hinzufügen"
              className={`flex-1 ${inputClass}`}
            />
            <button type="button" onClick={addTodo} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface-hover">
              Hinzufügen
            </button>
          </div>
          <ul className="space-y-1">
            {todos.map((todo, index) => (
              <li key={index} className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-1.5 text-sm">
                <span>{todo}</span>
                <button
                  type="button"
                  onClick={() => setTodos((t) => t.filter((_, i) => i !== index))}
                  className="text-xs text-muted-foreground hover:text-negative"
                >
                  Entfernen
                </button>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90 disabled:opacity-60"
        >
          {pending ? "Speichern…" : `Daily Review für ${tradeDate} speichern`}
        </button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-lg border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}
