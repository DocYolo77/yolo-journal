"use client";

import { useActionState, useState, type ReactNode } from "react";
import { FieldNumber, FieldSelect, FieldText, FieldTextarea } from "@/components/ui/form-fields";
import { WatchlistEditor, type WatchlistRow } from "./watchlist-editor";
import { EpCandidatesEditor, type EpCandidateRow } from "./ep-candidates-editor";
import {
  ALLOWED_RISK_PCTS,
  emptyCommitmentFormState,
  type CommitmentFormState,
} from "@/lib/validation/commitment";
import type { CommitmentWithChildren } from "@/lib/data/commitments";

const RISK_OPTIONS = ALLOWED_RISK_PCTS.map((v) => ({ value: String(v), label: `${v}%` }));

function toWatchlistRows(commitment: CommitmentWithChildren | null): WatchlistRow[] {
  if (!commitment) return [];
  return commitment.watchlist.map((item) => ({
    ticker: item.ticker,
    riskPct: item.risk_pct != null ? String(item.risk_pct) : "",
    listType: item.list_type,
    notes: item.notes ?? "",
  }));
}

function toEpCandidateRows(commitment: CommitmentWithChildren | null): EpCandidateRow[] {
  if (!commitment) return [];
  return commitment.ep_candidates.map((c) => ({
    ticker: c.ticker,
    gap8Pct: c.gap_8_pct,
    rvol15: c.rvol_1_5,
    newsTrigger: c.news_trigger,
    eventDay: c.event_day,
    contextNotDefensive: c.context_not_defensive,
    notes: c.notes ?? "",
  }));
}

export function CommitmentForm({
  action,
  lockAction,
  existing,
}: {
  action: (state: CommitmentFormState, formData: FormData) => Promise<CommitmentFormState>;
  lockAction: (state: CommitmentFormState, formData: FormData) => Promise<CommitmentFormState>;
  existing: CommitmentWithChildren | null;
}) {
  const [state, formAction, pending] = useActionState(action, emptyCommitmentFormState);
  const [lockState, lockFormAction, lockPending] = useActionState(lockAction, emptyCommitmentFormState);

  const [watchlist, setWatchlist] = useState<WatchlistRow[]>(() => toWatchlistRows(existing));
  const [epCandidates, setEpCandidates] = useState<EpCandidateRow[]>(() => toEpCandidateRows(existing));

  const errors = state.fieldErrors;
  const watchlistTickers = watchlist.map((w) => w.ticker.toUpperCase()).filter(Boolean);

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-6">
        {state.formError ? (
          <p className="rounded-md border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-negative">
            {state.formError}
          </p>
        ) : null}

        <input type="hidden" name="watchlistJson" value={JSON.stringify(watchlist)} readOnly />
        <input type="hidden" name="epCandidatesJson" value={JSON.stringify(epCandidates)} readOnly />

        <Section title="1 · State + R%">
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldText
              name="personalState"
              label="Persönlicher Status"
              defaultValue={existing?.personal_state ?? ""}
              error={errors.personalState}
              required
            />
            <FieldSelect
              name="systemRiskPct"
              label="System-Risiko-Cap"
              defaultValue={existing?.system_risk_pct != null ? String(existing.system_risk_pct) : undefined}
              error={errors.systemRiskPct}
              options={RISK_OPTIONS}
              placeholder="Bitte wählen"
            />
            <FieldSelect
              name="committedRiskPct"
              label="Committed-Risiko"
              defaultValue={existing?.committed_risk_pct != null ? String(existing.committed_risk_pct) : undefined}
              error={errors.committedRiskPct}
              options={RISK_OPTIONS}
              placeholder="Bitte wählen"
              required
            />
          </div>
          <FieldTextarea
            name="marketStateNote"
            label="Marktzustand-Notiz"
            defaultValue={existing?.market_state_note ?? ""}
            error={errors.marketStateNote}
          />
        </Section>

        <Section title="2 · QQQ-Extension">
          <FieldNumber
            name="qqqAtrMultiple"
            label="ATR-Multiple"
            defaultValue={existing?.qqq_extension_atr_multiple != null ? String(existing.qqq_extension_atr_multiple) : ""}
            error={errors.qqqAtrMultiple}
          />
          <FieldTextarea
            name="qqqNote"
            label="Notiz"
            defaultValue={existing?.qqq_extension_note ?? ""}
            error={errors.qqqNote}
          />
          <p className="text-xs text-muted-foreground">
            Risk-Cap (0.5%) aktiviert sich automatisch ab ATR-Multiple ≥ 8.
          </p>
        </Section>

        <Section title="3 · MTD % — nur neue Entries">
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldNumber
              name="mtdManualPct"
              label="MTD % (manuell)"
              defaultValue={existing?.mtd_manual_pct != null ? String(existing.mtd_manual_pct) : ""}
              error={errors.mtdManualPct}
              required
            />
            <FieldNumber
              name="mtdAutoFreshEntryRealizedPct"
              label="Auto Fresh-Entry realized %"
              defaultValue={
                existing?.mtd_auto_fresh_entry_realized_pct != null
                  ? String(existing.mtd_auto_fresh_entry_realized_pct)
                  : ""
              }
              error={errors.mtdAutoFreshEntryRealizedPct}
            />
          </div>
          <FieldTextarea name="mtdNote" label="Notiz" defaultValue={existing?.mtd_note ?? ""} error={errors.mtdNote} />
          <p className="text-xs text-muted-foreground">
            Pause-Schwelle (MTD ≤ -7.5%) wird automatisch erkannt.
          </p>
        </Section>

        <Section title="4 · Verlustzähler">
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldNumber
              name="lossManualCounter"
              label="Verlustzähler (manuell)"
              defaultValue={existing?.loss_state_manual_counter != null ? String(existing.loss_state_manual_counter) : ""}
              error={errors.lossManualCounter}
              required
            />
            <FieldNumber
              name="lossAutoCounter"
              label="Verlustzähler (auto)"
              defaultValue={existing?.loss_state_auto_counter != null ? String(existing.loss_state_auto_counter) : ""}
              error={errors.lossAutoCounter}
            />
          </div>
          <FieldTextarea name="lossNote" label="Notiz" defaultValue={existing?.loss_state_note ?? ""} error={errors.lossNote} />
          <p className="text-xs text-muted-foreground">
            Ab 6 Verlusten: Reduced-Size-Mode. Ab 10 Verlusten: Pflicht-Review-Warnung — beides automatisch
            abgeleitet.
          </p>
        </Section>

        <Section title="5 · Watchlist">
          <WatchlistEditor value={watchlist} onChange={setWatchlist} error={errors.watchlist} />
        </Section>

        <Section title="6 · EP-Kandidaten">
          <EpCandidatesEditor
            value={epCandidates}
            onChange={setEpCandidates}
            watchlistTickers={watchlistTickers}
            error={errors.epCandidates}
          />
        </Section>

        <Section title="7 · Operativer Plan">
          <FieldTextarea
            name="operationalPlan"
            label="Operativer Plan"
            defaultValue={existing?.operational_plan ?? ""}
            error={errors.operationalPlan}
            required
          />
          <FieldTextarea
            name="improvementFocus"
            label="Improvement Focus"
            defaultValue={existing?.improvement_focus ?? ""}
            error={errors.improvementFocus}
          />
        </Section>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90 disabled:opacity-60"
          >
            {pending ? "Speichern…" : "Als Draft speichern"}
          </button>
        </div>
      </form>

      {existing ? (
        <form action={lockFormAction} className="rounded-lg border border-border bg-surface p-4">
          {lockState.formError ? (
            <p className="mb-3 rounded-md border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-negative">
              {lockState.formError}
            </p>
          ) : null}
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <p className="text-sm text-muted-foreground">
              Revision {existing.revision} · Status {existing.status}. Nach dem Lock sind Watchlist,
              EP-Kandidaten und Hard Rules dieser Revision unveränderlich; Intraday-Risiko kann danach nur
              noch reduziert werden.
            </p>
            <button
              type="submit"
              disabled={lockPending}
              className="shrink-0 rounded-md border border-accent px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/10 disabled:opacity-60"
            >
              {lockPending ? "Locke…" : "Commitment locken"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
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
