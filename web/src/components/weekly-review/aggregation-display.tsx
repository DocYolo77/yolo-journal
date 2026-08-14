import type { ReactNode } from "react";
import { renderDailyChartSvg, renderNlvChartSvg } from "@/lib/charts/svg-chart";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { WeeklyAggregation } from "@/lib/supabase/types";

const NA = "nicht verfügbar";

function pct(value: number | null): string {
  return value != null ? `${formatNumber(value)}%` : NA;
}

/**
 * Renders the fully automatic §3-13 aggregation — shared verbatim
 * between the live DRAFT Weekly Review page (recomputed every load)
 * and the FINAL report page (rendered from the frozen snapshot). Purely
 * presentational; the manual interpretation fields live outside this
 * component since editable vs. read-only differs between the two
 * callers.
 */
export function WeeklyAggregationDisplay({ aggregation }: { aggregation: WeeklyAggregation }) {
  const {
    summary,
    preconditions,
    balance,
    enforcement,
    evidence,
    shadow_log,
    largest_missed_move,
    setup_breakdown,
    cooldown,
    diagnostics,
    repetition,
    state_analysis,
  } = aggregation;

  return (
    <div className="space-y-6">
      <Section title="Wochen-Summary">
        <DetailGrid
          items={[
            ["Zeitraum", `${summary.week_start} – ${summary.week_end}`],
            ["Start-NLV", formatCurrency(summary.start_nlv)],
            ["End-NLV", formatCurrency(summary.end_nlv)],
            [
              "NLV-Änderung",
              summary.nlv_change_dollar != null
                ? `${formatCurrency(summary.nlv_change_dollar)} (${pct(summary.nlv_change_pct)})`
                : NA,
            ],
            ["Realized P&L", formatCurrency(summary.realized_pnl_dollar)],
            ["Unrealized P&L Change", formatCurrency(summary.unrealized_pnl_change_dollar)],
            ["Daily Reviews", String(summary.daily_review_count)],
            ["Entry-Tage", String(summary.entry_day_count)],
            ["Management-/Null-Tage", String(summary.management_or_zero_day_count)],
            ["Neue Campaigns", String(summary.new_campaign_count)],
            ["Geschlossene Campaigns", String(summary.closed_campaign_count)],
            ["Tatsächlich gehandelte Ticker", String(summary.actually_traded_ticker_count)],
            ["Executions", String(summary.execution_count)],
            ["Avg committed Risk", summary.avg_committed_risk_pct != null ? pct(summary.avg_committed_risk_pct) : NA],
            [
              "Losing-Streak",
              summary.losing_streak_start ? `${summary.losing_streak_start} → ${summary.losing_streak_end ?? "laufend"}` : "keine",
            ],
          ]}
        />
        <p className="text-xs text-muted-foreground">
          Realized P&L (geschlossene Campaigns) und Unrealized P&L Change (offene Positionen) sind getrennt
          ausgewiesen — ein bestehender Gewinner, der unrealisierte Gewinne abgibt, wird nicht als schlechte neue
          Entry gewertet.
        </p>
      </Section>

      <Section title="Preconditions / Ausgangslage">
        <div className="grid gap-4 sm:grid-cols-2">
          {preconditions.index_context.map((idx) => (
            <div key={idx.ticker}>
              <p className="mb-1 text-xs font-medium text-muted-foreground">{idx.ticker}</p>
              <InlineSvg svg={renderDailyChartSvg(idx.ticker, idx.daily)} />
            </div>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="py-2 pr-4">Tag</th>
                <th className="py-2 pr-4">Marktumgebung</th>
                <th className="py-2 pr-4">Committed Risk</th>
                <th className="py-2 pr-4">MTD-Pause</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {preconditions.daily_market_environment.map((d) => {
                const risk = preconditions.committed_risk_by_day.find((r) => r.trade_date === d.trade_date);
                const mtd = preconditions.mtd_status_by_day.find((m) => m.trade_date === d.trade_date);
                return (
                  <tr key={d.trade_date}>
                    <td className="py-2 pr-4 font-medium text-foreground">{d.trade_date}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{d.market_environment ?? "–"}</td>
                    <td className="py-2 pr-4 text-foreground">{risk?.committed_risk_pct != null ? pct(risk.committed_risk_pct) : "–"}</td>
                    <td className="py-2 pr-4 text-foreground">{mtd?.mtd_pause_threshold_reached ? "erreicht" : "–"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {preconditions.reduced_size_days.length > 0 ? (
          <p className="text-xs text-muted-foreground">Reduziertes Risiko an: {preconditions.reduced_size_days.join(", ")}</p>
        ) : null}
        {preconditions.losing_streak_review_trigger_days.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Losing-Streak-Review-Trigger an: {preconditions.losing_streak_review_trigger_days.join(", ")}
          </p>
        ) : null}
      </Section>

      <Section title="Balance / Performance">
        <InlineSvg svg={renderNlvChartSvg(balance.nlv_series)} />
        <DetailGrid
          items={[
            ["Gewinner", balance.winner_count != null ? String(balance.winner_count) : NA],
            ["Verlierer", balance.loser_count != null ? String(balance.loser_count) : NA],
            ["Win Rate", pct(balance.win_rate_pct)],
            ["Avg Winner $", formatCurrency(balance.avg_winner_dollar)],
            ["Avg Loser $", formatCurrency(balance.avg_loser_dollar)],
            ["Total Realized $", formatCurrency(balance.total_realized_dollar)],
            ["Profit Factor", balance.profit_factor != null ? formatNumber(balance.profit_factor) : NA],
            ["Payoff Ratio", balance.payoff_ratio != null ? formatNumber(balance.payoff_ratio) : NA],
            ["Expectancy $", formatCurrency(balance.expectancy_dollar)],
            ["Max Winner $", formatCurrency(balance.max_winner_dollar)],
            ["Max Loser $", formatCurrency(balance.max_loser_dollar)],
          ]}
        />
        <p className="text-xs text-muted-foreground">
          R-Multiples: {NA} — Campaigns haben noch keinen hinterlegten Stop, daher keine Risiko-Basis für R.
        </p>
      </Section>

      <Section title="Enforcement / Rule Compliance">
        <p className="text-xs text-muted-foreground">
          {enforcement.reviews_with_guardrails_confirmed} von {enforcement.reviews_total} Daily Reviews mit bestätigten
          Guardrails (&bdquo;Guardrails geprüft?&rdquo;).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="py-2 pr-4">Guardrail</th>
                <th className="py-2 pr-4">Eingehalten</th>
                <th className="py-2 pr-4">Verletzt</th>
                <th className="py-2 pr-4">N/A</th>
                <th className="py-2 pr-4">Compliance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {enforcement.guardrails.map((g) => (
                <tr key={g.guardrail_id}>
                  <td className="py-2 pr-4 text-foreground">{g.guardrail}</td>
                  <td className="py-2 pr-4 text-positive">{g.eingehalten_count}</td>
                  <td className={`py-2 pr-4 ${g.verletzt_count > 0 ? "text-negative" : "text-muted-foreground"}`}>
                    {g.verletzt_count}
                  </td>
                  <td className="py-2 pr-4 text-muted-foreground">{g.nicht_anwendbar_count}</td>
                  <td className="py-2 pr-4 text-foreground">{pct(g.compliance_rate_pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Worked / Not Worked — Evidenz">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Beste Campaigns</p>
            {evidence.best_campaigns.length > 0 ? (
              <ul className="space-y-1 text-sm">
                {evidence.best_campaigns.map((c) => (
                  <li key={c.campaign_id} className="text-positive">
                    {c.symbol} ({c.trade_date}): {formatCurrency(c.realized_pnl_dollar)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">–</p>
            )}
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Schlechteste Campaigns</p>
            {evidence.worst_campaigns.length > 0 ? (
              <ul className="space-y-1 text-sm">
                {evidence.worst_campaigns.map((c) => (
                  <li key={c.campaign_id} className="text-negative">
                    {c.symbol} ({c.trade_date}): {formatCurrency(c.realized_pnl_dollar)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">–</p>
            )}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TallyList label="Management Grades" items={evidence.management_grades} />
          <TallyList label="Rule Status" items={evidence.rule_statuses} />
        </div>
      </Section>

      <Section title="Stock Selection / Shadow Log">
        <DetailGrid
          items={[
            ["Committed Slots", String(shadow_log.committed_slots)],
            ["Prime Slots", String(shadow_log.prime_slots)],
            ["Genommen", String(shadow_log.genommen)],
            ["Nicht genommen", String(shadow_log.nicht_genommen)],
            ["Take Rate", pct(shadow_log.take_rate_pct)],
            ["Prime Take Rate", pct(shadow_log.prime_take_rate_pct)],
          ]}
        />
        <p className="text-sm text-muted-foreground">
          Tatsächlich gehandelt: {shadow_log.actually_traded_tickers.length > 0 ? shadow_log.actually_traded_tickers.join(", ") : "keine"}
        </p>
        {!shadow_log.shadow_model_available ? (
          <p className="text-xs text-muted-foreground">
            M5/M15/M30-Shadowmodell: {NA} — noch nicht befüllt.
          </p>
        ) : null}
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Largest Missed Move</p>
          {largest_missed_move ? (
            <p className="text-sm text-foreground">
              {largest_missed_move.ticker} ({largest_missed_move.list_type}, {largest_missed_move.trade_date}) —{" "}
              {largest_missed_move.decision}
              {largest_missed_move.reason ? `, Grund: ${largest_missed_move.reason}` : ""}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">{NA} — ohne Shadow-Modell keine Magnitude ableitbar.</p>
          )}
        </div>
      </Section>

      <Section title="Setup / Structure / Entry-Taktik Breakdown">
        <BreakdownTable title="Setup" groups={setup_breakdown.by_setup} />
        <BreakdownTable title="Structure" groups={setup_breakdown.by_structure} />
        <BreakdownTable title="Entry-Taktik" groups={setup_breakdown.by_entry_tactic} />
      </Section>

      <Section title="Cooldown / Anti-Hot-Hand">
        {cooldown.available ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4"></th>
                  <th className="py-2 pr-4">Entries</th>
                  <th className="py-2 pr-4">Win Rate</th>
                  <th className="py-2 pr-4">Avg $</th>
                  <th className="py-2 pr-4">Guardrail-Verstöße</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {cooldown.groups.map((g) => (
                  <tr key={g.label}>
                    <td className="py-2 pr-4 font-medium text-foreground">
                      {g.label === "after_winner" ? "Nach Gewinner" : "Nach Verlierer"}
                    </td>
                    <td className="py-2 pr-4 text-foreground">{g.entry_count}</td>
                    <td className="py-2 pr-4 text-foreground">{pct(g.win_rate_pct)}</td>
                    <td className="py-2 pr-4 text-foreground">{formatCurrency(g.avg_dollar)}</td>
                    <td className="py-2 pr-4 text-foreground">{g.guardrail_violation_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{cooldown.note}</p>
        )}
      </Section>

      <Section title="Diagnostic Checks">
        {(["selection", "execution", "management", "risk"] as const).map((category) => (
          <div key={category} className="mb-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{category}</p>
            <ul className="space-y-1 text-sm">
              {diagnostics
                .filter((d) => d.category === category)
                .map((d) => (
                  <li key={d.check_id} className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
                    <span
                      className={
                        d.triggered === null ? "text-muted-foreground" : d.triggered ? "text-negative" : "text-positive"
                      }
                    >
                      {d.triggered === null ? "n/v" : d.triggered ? "auffällig" : "unauffällig"}
                    </span>
                    <span className="text-foreground">{d.label}</span>
                    <span className="text-xs text-muted-foreground">— {d.detail}</span>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </Section>

      <Section title="Repetition / Problem Loops">
        {repetition.problem_loops.length === 0 && repetition.recurring_positives.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch nicht genug Wochenhistorie (mindestens 3 Wochen inkl. dieser nötig) oder keine wiederkehrenden Muster
            erkannt.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Problem Loops</p>
              {repetition.problem_loops.length > 0 ? (
                <ul className="space-y-1 text-sm text-negative">
                  {repetition.problem_loops.map((p) => (
                    <li key={p.label}>
                      {p.label} — {p.weeks_seen} von {p.weeks_checked} Wochen
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">–</p>
              )}
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Recurring Positives</p>
              {repetition.recurring_positives.length > 0 ? (
                <ul className="space-y-1 text-sm text-positive">
                  {repetition.recurring_positives.map((p) => (
                    <li key={p.label}>
                      {p.label} — {p.weeks_seen} von {p.weeks_checked} Wochen
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">–</p>
              )}
            </div>
          </div>
        )}
      </Section>

      <Section title="Pattern / State Analysis">
        {state_analysis.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Tage</th>
                  <th className="py-2 pr-4">Campaigns</th>
                  <th className="py-2 pr-4">Avg $</th>
                  <th className="py-2 pr-4">Win Rate</th>
                  <th className="py-2 pr-4">Guardrail-Verstöße</th>
                  <th className="py-2 pr-4">Avg Focus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {state_analysis.map((s) => (
                  <tr key={s.state}>
                    <td className="py-2 pr-4 font-medium text-foreground">{s.state}</td>
                    <td className="py-2 pr-4 text-foreground">{s.day_count}</td>
                    <td className="py-2 pr-4 text-foreground">{s.campaign_count}</td>
                    <td className="py-2 pr-4 text-foreground">{formatCurrency(s.avg_dollar)}</td>
                    <td className="py-2 pr-4 text-foreground">{pct(s.win_rate_pct)}</td>
                    <td className="py-2 pr-4 text-foreground">{s.guardrail_violation_count}</td>
                    <td className="py-2 pr-4 text-foreground">{s.avg_focus != null ? formatNumber(s.avg_focus) : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Keine Mental-States diese Woche erfasst.</p>
        )}
        <p className="text-xs text-muted-foreground">
          Nur Zusammenhänge, keine Kausalität — z.B. &bdquo;an X Tagen mit Status Y: Avg Campaign Result Z$&rdquo;.
        </p>
      </Section>
    </div>
  );
}

function BreakdownTable({ title, groups }: { title: string; groups: { value: string; count: number; win_rate_pct: number | null; avg_dollar: number | null; total_dollar: number | null }[] }) {
  if (groups.length === 0) {
    return (
      <div className="mb-3">
        <p className="mb-1 text-xs font-medium text-muted-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">–</p>
      </div>
    );
  }
  return (
    <div className="mb-3 overflow-x-auto">
      <p className="mb-1 text-xs font-medium text-muted-foreground">{title}</p>
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="py-2 pr-4">{title}</th>
            <th className="py-2 pr-4">Count</th>
            <th className="py-2 pr-4">Win Rate</th>
            <th className="py-2 pr-4">Avg $</th>
            <th className="py-2 pr-4">Total $</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {groups.map((g) => (
            <tr key={g.value}>
              <td className="py-2 pr-4 font-medium text-foreground">{g.value}</td>
              <td className="py-2 pr-4 text-foreground">{g.count}</td>
              <td className="py-2 pr-4 text-foreground">{pct(g.win_rate_pct)}</td>
              <td className="py-2 pr-4 text-foreground">{formatCurrency(g.avg_dollar)}</td>
              <td className="py-2 pr-4 text-foreground">{formatCurrency(g.total_dollar)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TallyList({ label, items }: { label: string; items: { value: string; count: number }[] }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      {items.length > 0 ? (
        <ul className="space-y-0.5 text-sm text-foreground">
          {items.map((i) => (
            <li key={i.value}>
              {i.value}: {i.count}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">–</p>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function DetailGrid({ items }: { items: [string, string][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-3 text-sm sm:justify-start">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function InlineSvg({ svg }: { svg: string }) {
  return (
    <div
      className="overflow-x-auto rounded-md border border-border"
      // Own hand-rolled SVG output (lib/charts/svg-chart.ts) — no
      // user-controlled HTML ever flows through here.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
