"use client";

import { useActionState, useState, useTransition, type ReactNode } from "react";
import { FieldNumber, FieldSelect, FieldTextarea } from "@/components/ui/form-fields";
import { WatchlistEditor, type WatchlistRow } from "./watchlist-editor";
import { EpCandidatesEditor, type EpCandidateRow } from "./ep-candidates-editor";
import {
  ALLOWED_RISK_PCTS,
  emptyCommitmentFormState,
  type CommitmentFormState,
} from "@/lib/validation/commitment";
import type { CommitmentWithChildren } from "@/lib/data/commitments";
import { fetchIndexExtensionAction } from "@/app/actions";
import type { IndexExtensionSnapshot } from "@/lib/market-data/provider";

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
  allowLiveMassiveFetch = true,
}: {
  action: (state: CommitmentFormState, formData: FormData) => Promise<CommitmentFormState>;
  lockAction: (state: CommitmentFormState, formData: FormData) => Promise<CommitmentFormState>;
  existing: CommitmentWithChildren | null;
  /** False when backfilling a past date — "live" market data is always
   * as-of now, so it would be misleading to stamp it onto a historical
   * commitment. */
  allowLiveMassiveFetch?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, emptyCommitmentFormState);
  const [lockState, lockFormAction, lockPending] = useActionState(lockAction, emptyCommitmentFormState);

  const [watchlist, setWatchlist] = useState<WatchlistRow[]>(() => toWatchlistRows(existing));
  const [epCandidates, setEpCandidates] = useState<EpCandidateRow[]>(() => toEpCandidateRows(existing));

  const [qqqAtrMultipleValue, setQqqAtrMultipleValue] = useState(
    existing?.qqq_extension_atr_multiple != null ? String(existing.qqq_extension_atr_multiple) : ""
  );
  const [qqqLive, setQqqLive] = useState<{ data: IndexExtensionSnapshot | null; error: string | null }>({
    data: null,
    error: null,
  });
  const [qqqPending, startQqqTransition] = useTransition();

  function handleFetchQqqExtension() {
    startQqqTransition(async () => {
      const result = await fetchIndexExtensionAction("QQQ");
      if (!result.data) {
        setQqqLive({ data: null, error: result.error });
        return;
      }
      setQqqLive({ data: result.data, error: null });
      if (result.data.atrExtensionMultiple !== null) {
        setQqqAtrMultipleValue(result.data.atrExtensionMultiple.toFixed(2));
      }
    });
  }

  const [spyAtrMultipleValue, setSpyAtrMultipleValue] = useState(
    existing?.spy_extension_atr_multiple != null ? String(existing.spy_extension_atr_multiple) : ""
  );
  const [spyLive, setSpyLive] = useState<{ data: IndexExtensionSnapshot | null; error: string | null }>({
    data: null,
    error: null,
  });
  const [spyPending, startSpyTransition] = useTransition();

  function handleFetchSpyExtension() {
    startSpyTransition(async () => {
      const result = await fetchIndexExtensionAction("SPY");
      if (!result.data) {
        setSpyLive({ data: null, error: result.error });
        return;
      }
      setSpyLive({ data: result.data, error: null });
      if (result.data.atrExtensionMultiple !== null) {
        setSpyAtrMultipleValue(result.data.atrExtensionMultiple.toFixed(2));
      }
    });
  }

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
            label="Allgemeine Marktlage und persönlicher Zustand"
            placeholder="z. B. Markt ruhig/nervös, eigener Fokus/Energie, Schlaf, Ablenkungen, Grundstimmung vor der Session…"
            defaultValue={existing?.market_state_note ?? ""}
            error={errors.marketStateNote}
            required
          />
        </Section>

        <Section title="2 · Index-Lage (QQQ/SPY)">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <FieldNumber
                    key={qqqAtrMultipleValue}
                    name="qqqAtrMultiple"
                    label="QQQ ATR-Multiple"
                    placeholder="z. B. 3.5"
                    defaultValue={qqqAtrMultipleValue}
                    error={errors.qqqAtrMultiple}
                  />
                </div>
                {allowLiveMassiveFetch ? (
                  <button
                    type="button"
                    onClick={handleFetchQqqExtension}
                    disabled={qqqPending}
                    className="shrink-0 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface disabled:opacity-60"
                  >
                    {qqqPending ? "Lädt…" : "Live laden"}
                  </button>
                ) : null}
              </div>
              {qqqLive.error ? (
                <p className="text-xs text-negative">{qqqLive.error}</p>
              ) : qqqLive.data ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    Preis {qqqLive.data.price ?? "–"} · SMA50 {qqqLive.data.sma50 ?? "–"} · ATR14{" "}
                    {qqqLive.data.atr14 ?? "–"}
                  </p>
                  {qqqLive.data.diagnostic ? (
                    <p className="text-xs text-negative">{qqqLive.data.diagnostic}</p>
                  ) : null}
                </>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Risk-Cap (0.5%) aktiviert sich automatisch ab QQQ-ATR-Multiple ≥ 8.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <FieldNumber
                    key={spyAtrMultipleValue}
                    name="spyAtrMultiple"
                    label="SPY ATR-Multiple"
                    placeholder="z. B. 2.1"
                    defaultValue={spyAtrMultipleValue}
                    error={errors.spyAtrMultiple}
                  />
                </div>
                {allowLiveMassiveFetch ? (
                  <button
                    type="button"
                    onClick={handleFetchSpyExtension}
                    disabled={spyPending}
                    className="shrink-0 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface disabled:opacity-60"
                  >
                    {spyPending ? "Lädt…" : "Live laden"}
                  </button>
                ) : null}
              </div>
              {spyLive.error ? (
                <p className="text-xs text-negative">{spyLive.error}</p>
              ) : spyLive.data ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    Preis {spyLive.data.price ?? "–"} · SMA50 {spyLive.data.sma50 ?? "–"} · ATR14{" "}
                    {spyLive.data.atr14 ?? "–"}
                  </p>
                  {spyLive.data.diagnostic ? (
                    <p className="text-xs text-negative">{spyLive.data.diagnostic}</p>
                  ) : null}
                </>
              ) : null}
              <p className="text-xs text-muted-foreground">Nur informative Zweitlesung, kein eigener Risk-Cap.</p>
            </div>
          </div>
          {!allowLiveMassiveFetch ? (
            <p className="text-xs text-muted-foreground">
              Live-Abruf ist bei Nacherfassung vergangener Tage deaktiviert — aktuelle Marktdaten passen
              nicht zu einem historischen Datum. Bitte manuell eintragen.
            </p>
          ) : null}
          <FieldTextarea
            name="qqqNote"
            label="Notiz"
            placeholder="z. B. Trend, Volumen, Reaktion auf News, Distanz zu Schlüssellevels…"
            defaultValue={existing?.qqq_extension_note ?? ""}
            error={errors.qqqNote}
          />
        </Section>

        <Section title="3 · MTD % — nur neue Entries">
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldNumber
              name="mtdManualPct"
              label="MTD % (manuell)"
              placeholder="z. B. -2.5"
              defaultValue={existing?.mtd_manual_pct != null ? String(existing.mtd_manual_pct) : ""}
              error={errors.mtdManualPct}
              required
            />
            <FieldNumber
              name="mtdAutoFreshEntryRealizedPct"
              label="Auto Fresh-Entry realized %"
              placeholder="falls vorhanden"
              defaultValue={
                existing?.mtd_auto_fresh_entry_realized_pct != null
                  ? String(existing.mtd_auto_fresh_entry_realized_pct)
                  : ""
              }
              error={errors.mtdAutoFreshEntryRealizedPct}
            />
          </div>
          <FieldTextarea
            name="mtdNote"
            label="Notiz"
            placeholder="Kontext zur MTD-Zahl, z. B. große Einzelposition, Sondereffekt…"
            defaultValue={existing?.mtd_note ?? ""}
            error={errors.mtdNote}
          />
          <p className="text-xs text-muted-foreground">
            Pause-Schwelle (MTD ≤ -7.5%) wird automatisch erkannt.
          </p>
        </Section>

        <Section title="4 · Verlustzähler">
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldNumber
              name="lossManualCounter"
              label="Verlustzähler (manuell)"
              placeholder="Anzahl Verluste in Folge"
              defaultValue={existing?.loss_state_manual_counter != null ? String(existing.loss_state_manual_counter) : ""}
              error={errors.lossManualCounter}
              required
            />
            <FieldNumber
              name="lossAutoCounter"
              label="Verlustzähler (auto)"
              placeholder="falls automatisch ermittelt"
              defaultValue={existing?.loss_state_auto_counter != null ? String(existing.loss_state_auto_counter) : ""}
              error={errors.lossAutoCounter}
            />
          </div>
          <FieldTextarea
            name="lossNote"
            label="Notiz"
            placeholder="z. B. Ursache der Verluste, Muster erkannt…"
            defaultValue={existing?.loss_state_note ?? ""}
            error={errors.lossNote}
          />
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
            placeholder="Was ist heute konkret der Plan? Welche Setups, welche Trigger, welche Reihenfolge…"
            defaultValue={existing?.operational_plan ?? ""}
            error={errors.operationalPlan}
            required
          />
          <FieldTextarea
            name="improvementFocus"
            label="Improvement Focus"
            placeholder="Woran arbeitest du heute gezielt? z. B. Geduld auf Trigger warten, Stops nicht verschieben…"
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
