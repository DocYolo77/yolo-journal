import { RiskReductionForm } from "./risk-reduction-form";
import type { CommitmentWithChildren } from "@/lib/data/commitments";
import type { AuditEventRow, CommitmentRiskChangeRow } from "@/lib/supabase/types";
import type { CommitmentFormState } from "@/lib/validation/commitment";
import { formatDateTime } from "@/lib/format";

export function LockedCommitmentView({
  commitment,
  riskChanges,
  auditEvents,
  reduceRiskAction,
}: {
  commitment: CommitmentWithChildren;
  riskChanges: CommitmentRiskChangeRow[];
  auditEvents: AuditEventRow[];
  reduceRiskAction: (state: CommitmentFormState, formData: FormData) => Promise<CommitmentFormState>;
}) {
  const epCandidateSummary = (candidate: CommitmentWithChildren["ep_candidates"][number]) =>
    [
      candidate.gap_8_pct && "Gap ≥ 8%",
      candidate.rvol_1_5 && "RVOL ≥ 1.5",
      candidate.news_trigger && "News",
      candidate.event_day && "Event-Day",
      candidate.context_not_defensive && "Context nicht defensiv",
    ]
      .filter(Boolean)
      .join(" · ") || "keine Kriterien markiert";

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Gelockt · Revision {commitment.revision}</h2>
          <span className="rounded-full bg-positive/10 px-2 py-0.5 text-xs text-positive">LOCKED</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Gelockt am {formatDateTime(commitment.locked_at)}. Watchlist, EP-Kandidaten und Hard Rules dieser
          Revision sind unveränderlich.
        </p>
      </section>

      <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <h3 className="text-sm font-semibold text-foreground">1 · State + R%</h3>
        <DetailGrid
          items={[
            ["System-Risiko-Cap", commitment.system_risk_pct != null ? `${commitment.system_risk_pct}%` : "–"],
            ["Committed-Risiko", commitment.committed_risk_pct != null ? `${commitment.committed_risk_pct}%` : "–"],
            ["Intraday-Risiko (aktuell)", commitment.intraday_risk_pct != null ? `${commitment.intraday_risk_pct}%` : "–"],
          ]}
        />
        {commitment.personal_state ? (
          // Legacy field from before "Persönlicher Status" and
          // "Marktzustand-Notiz" were consolidated into one box — only
          // ever populated on commitments saved before that change.
          <p className="text-xs text-muted-foreground">
            Persönlicher Status (legacy): {commitment.personal_state}
          </p>
        ) : null}
        {commitment.market_state_note ? (
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Allgemeine Marktlage und persönlicher Zustand
            </p>
            <p className="text-sm text-muted-foreground">{commitment.market_state_note}</p>
          </div>
        ) : null}
      </section>

      <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <h3 className="text-sm font-semibold text-foreground">2 · Index-Lage (QQQ/SPY)</h3>
        <DetailGrid
          items={[
            [
              "QQQ ATR-Multiple",
              commitment.qqq_extension_atr_multiple != null ? String(commitment.qqq_extension_atr_multiple) : "–",
            ],
            ["QQQ Risk-Cap aktiv", commitment.qqq_extension_cap_active ? "ja (0.5%)" : "nein"],
            [
              "SPY ATR-Multiple",
              commitment.spy_extension_atr_multiple != null ? String(commitment.spy_extension_atr_multiple) : "–",
            ],
          ]}
        />
        {commitment.qqq_extension_note ? (
          <div>
            <p className="text-xs font-medium text-muted-foreground">Notiz</p>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{commitment.qqq_extension_note}</p>
          </div>
        ) : null}
      </section>

      <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <h3 className="text-sm font-semibold text-foreground">3 · MTD % — nur neue Entries</h3>
        <DetailGrid
          items={[
            ["MTD % (manuell)", commitment.mtd_manual_pct != null ? `${commitment.mtd_manual_pct}%` : "–"],
            [
              "Auto Fresh-Entry realized %",
              commitment.mtd_auto_fresh_entry_realized_pct != null
                ? `${commitment.mtd_auto_fresh_entry_realized_pct}%`
                : "–",
            ],
            ["MTD-Pause-Schwelle", commitment.mtd_pause_threshold_reached ? "erreicht (≤ -7.5%)" : "nicht erreicht"],
          ]}
        />
        {commitment.mtd_note ? (
          <div>
            <p className="text-xs font-medium text-muted-foreground">Notiz</p>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{commitment.mtd_note}</p>
          </div>
        ) : null}
      </section>

      <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <h3 className="text-sm font-semibold text-foreground">4 · Verlustzähler</h3>
        <DetailGrid
          items={[
            [
              "Verlustzähler (manuell)",
              commitment.loss_state_manual_counter != null ? String(commitment.loss_state_manual_counter) : "–",
            ],
            [
              "Verlustzähler (auto)",
              commitment.loss_state_auto_counter != null ? String(commitment.loss_state_auto_counter) : "–",
            ],
            ["Reduced-Size-Mode", commitment.loss_state_reduced_size_mode ? "aktiv (ab 6 Verlusten)" : "inaktiv"],
            [
              "Pflicht-Review-Warnung",
              commitment.loss_state_review_trigger_reached ? "ausgelöst (ab 10 Verlusten)" : "nicht ausgelöst",
            ],
          ]}
        />
        {commitment.loss_state_note ? (
          <div>
            <p className="text-xs font-medium text-muted-foreground">Notiz</p>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{commitment.loss_state_note}</p>
          </div>
        ) : null}
      </section>

      <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <h3 className="text-sm font-semibold text-foreground">5 · Watchlist ({commitment.watchlist.length})</h3>
        {commitment.watchlist.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4">Ticker</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4 text-right">Risk %</th>
                  <th className="py-2 pr-4">Notiz</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {commitment.watchlist.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2 pr-4 font-medium text-foreground">{item.ticker}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{item.list_type}</td>
                    <td className="py-2 pr-4 text-right text-foreground">{item.risk_pct ?? "–"}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{item.notes ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Keine Watchlist-Ticker.</p>
        )}
      </section>

      {commitment.ep_candidates.length > 0 ? (
        <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
          <h3 className="text-sm font-semibold text-foreground">
            6 · EP-Kandidaten ({commitment.ep_candidates.length})
          </h3>
          <div className="space-y-2">
            {commitment.ep_candidates.map((candidate) => (
              <div key={candidate.id} className="rounded-md border border-border p-3 text-sm">
                <span className="font-medium text-foreground">{candidate.ticker}</span>{" "}
                <span className="text-muted-foreground">{epCandidateSummary(candidate)}</span>
                {candidate.notes ? <p className="mt-1 text-muted-foreground">{candidate.notes}</p> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <h3 className="text-sm font-semibold text-foreground">7 · Operativer Plan</h3>
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{commitment.operational_plan ?? "–"}</p>
        {commitment.improvement_focus ? (
          <>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Improvement Focus
            </h4>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{commitment.improvement_focus}</p>
          </>
        ) : null}
      </section>

      <RiskReductionForm action={reduceRiskAction} currentRiskPct={commitment.intraday_risk_pct} />

      {riskChanges.length > 0 ? (
        <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
          <h3 className="text-sm font-semibold text-foreground">Risiko-Reduktions-Historie</h3>
          <ul className="space-y-2 text-sm">
            {riskChanges.map((change) => (
              <li key={change.id} className="border-b border-border pb-2 last:border-0 last:pb-0">
                <span className="text-muted-foreground">{formatDateTime(change.changed_at)}</span>{" "}
                <span className="text-negative">{change.old_risk_pct}%</span>{" "}
                <span aria-hidden="true">→</span>{" "}
                <span className="text-positive">{change.new_risk_pct}%</span>
                {change.reason ? <span className="text-muted-foreground"> — {change.reason}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {auditEvents.length > 0 ? (
        <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
          <h3 className="text-sm font-semibold text-foreground">Audit-Trail (heute)</h3>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {auditEvents.map((event) => (
              <li key={event.event_id}>
                {formatDateTime(event.event_time)} — {event.event_type}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function DetailGrid({ items }: { items: [string, string][] }) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
          <dd className="mt-1 text-sm text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
