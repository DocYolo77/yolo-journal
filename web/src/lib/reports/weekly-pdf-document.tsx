/* eslint-disable jsx-a11y/alt-text -- @react-pdf/renderer's Image is a
   PDF-native primitive, not an HTML <img>; it has no `alt` prop and
   eslint-plugin-jsx-a11y can't tell the two apart. */
import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { WeeklyReportSnapshotData } from "@/lib/supabase/types";

// Deterministic PDF rendering of the same finalized weekly snapshot the
// web report renders — no LLM, no headless browser, same
// @react-pdf/renderer approach as the Daily Report PDF
// (lib/reports/pdf-document.tsx). Condensed relative to the web view
// (which shows full per-row breakdown tables) but covers every §18
// report section with real numbers, not a re-derivation.

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: "Helvetica", backgroundColor: "#0a0a0c", color: "#f4f4f5" },
  h1: { fontSize: 16, marginBottom: 2 },
  meta: { fontSize: 8, color: "#9a9aa4", marginBottom: 14 },
  section: { marginBottom: 10, padding: 8, borderWidth: 1, borderColor: "#232328", borderRadius: 4 },
  sectionTitle: { fontSize: 10, marginBottom: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  label: { color: "#9a9aa4" },
  value: { color: "#f4f4f5" },
  paragraph: { color: "#9a9aa4", marginTop: 4, lineHeight: 1.4 },
  chartImage: { width: "100%", marginTop: 6, marginBottom: 6 },
  tableHeader: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#232328", paddingBottom: 3, marginBottom: 3 },
  tableRow: { flexDirection: "row", paddingVertical: 2 },
  cell: { flex: 1, color: "#f4f4f5" },
  cellLabel: { flex: 1, color: "#9a9aa4" },
});

const NA = "n/v";

function fmt(value: number | null, digits = 2): string {
  return value == null ? "–" : value.toLocaleString("de-DE", { maximumFractionDigits: digits });
}

function pct(value: number | null): string {
  return value == null ? NA : `${fmt(value)}%`;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function WeeklyReportPdfDocument({
  snapshot,
  chartImages,
}: {
  snapshot: WeeklyReportSnapshotData;
  chartImages: { nlvChart: string; indexCharts: { ticker: string; dataUri: string }[] };
}) {
  const { aggregation, manual } = snapshot;
  const { summary, preconditions, balance, enforcement, evidence, shadow_log, largest_missed_move, setup_breakdown, cooldown, diagnostics, repetition, state_analysis } = aggregation;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Weekly Report — {snapshot.week_start} – {snapshot.week_end}</Text>
        <Text style={styles.meta}>
          Finalisiert am {new Date(snapshot.created_at).toLocaleString("de-DE")} · Schema v{snapshot.report_schema_version} ·
          basiert auf {snapshot.source_daily_report_ids.length} Daily Report(s)
        </Text>

        <Section title="Wochen-Summary">
          <DetailRow label="Start-NLV" value={fmt(summary.start_nlv)} />
          <DetailRow label="End-NLV" value={fmt(summary.end_nlv)} />
          <DetailRow label="NLV-Änderung" value={`${fmt(summary.nlv_change_dollar)} (${pct(summary.nlv_change_pct)})`} />
          <DetailRow label="Realized P&L" value={fmt(summary.realized_pnl_dollar)} />
          <DetailRow label="Unrealized P&L Change" value={fmt(summary.unrealized_pnl_change_dollar)} />
          <DetailRow label="Daily Reviews / Entry-Tage" value={`${summary.daily_review_count} / ${summary.entry_day_count}`} />
          <DetailRow label="Neue / Geschlossene Campaigns" value={`${summary.new_campaign_count} / ${summary.closed_campaign_count}`} />
          <DetailRow label="Executions" value={String(summary.execution_count)} />
          <DetailRow label="Avg committed Risk" value={pct(summary.avg_committed_risk_pct)} />
          <DetailRow
            label="Losing-Streak"
            value={summary.losing_streak_start ? `${summary.losing_streak_start} → ${summary.losing_streak_end ?? "laufend"}` : "keine"}
          />
        </Section>

        <Section title="Preconditions">
          {chartImages.indexCharts.map((c) => (
            <View key={c.ticker}>
              <Text style={styles.label}>{c.ticker}</Text>
              <Image src={c.dataUri} style={styles.chartImage} />
            </View>
          ))}
          {preconditions.reduced_size_days.length > 0 ? (
            <Text style={styles.paragraph}>Reduziertes Risiko: {preconditions.reduced_size_days.join(", ")}</Text>
          ) : null}
        </Section>

        <Section title="Balance / Performance">
          <Image src={chartImages.nlvChart} style={styles.chartImage} />
          <DetailRow label="Gewinner / Verlierer" value={`${balance.winner_count ?? NA} / ${balance.loser_count ?? NA}`} />
          <DetailRow label="Win Rate" value={pct(balance.win_rate_pct)} />
          <DetailRow label="Avg Winner / Loser $" value={`${fmt(balance.avg_winner_dollar)} / ${fmt(balance.avg_loser_dollar)}`} />
          <DetailRow label="Profit Factor" value={balance.profit_factor != null ? fmt(balance.profit_factor) : NA} />
          <DetailRow label="Expectancy $" value={fmt(balance.expectancy_dollar)} />
          <Text style={styles.paragraph}>R-Multiples: {NA} (kein Stop pro Campaign hinterlegt)</Text>
        </Section>
      </Page>

      <Page size="A4" style={styles.page}>
        <Section title="Enforcement / Rule Compliance">
          <View style={styles.tableHeader}>
            <Text style={styles.cellLabel}>Guardrail</Text>
            <Text style={styles.cellLabel}>Eingehalten</Text>
            <Text style={styles.cellLabel}>Verletzt</Text>
            <Text style={styles.cellLabel}>Compliance</Text>
          </View>
          {enforcement.guardrails.map((g) => (
            <View key={g.guardrail_id} style={styles.tableRow}>
              <Text style={styles.cell}>{g.guardrail}</Text>
              <Text style={styles.cell}>{g.eingehalten_count}</Text>
              <Text style={styles.cell}>{g.verletzt_count}</Text>
              <Text style={styles.cell}>{pct(g.compliance_rate_pct)}</Text>
            </View>
          ))}
        </Section>

        <Section title="Worked / Not Worked — Evidenz">
          {evidence.best_campaigns.map((c) => (
            <DetailRow key={c.campaign_id} label={`+ ${c.symbol} (${c.trade_date})`} value={fmt(c.realized_pnl_dollar)} />
          ))}
          {evidence.worst_campaigns.map((c) => (
            <DetailRow key={c.campaign_id} label={`- ${c.symbol} (${c.trade_date})`} value={fmt(c.realized_pnl_dollar)} />
          ))}
        </Section>

        <Section title="Stock Selection / Shadow Log">
          <DetailRow label="Committed / Prime Slots" value={`${shadow_log.committed_slots} / ${shadow_log.prime_slots}`} />
          <DetailRow label="Genommen / Nicht genommen" value={`${shadow_log.genommen} / ${shadow_log.nicht_genommen}`} />
          <DetailRow label="Take Rate / Prime Take Rate" value={`${pct(shadow_log.take_rate_pct)} / ${pct(shadow_log.prime_take_rate_pct)}`} />
          <DetailRow label="Tatsächlich gehandelt" value={shadow_log.actually_traded_tickers.join(", ") || "–"} />
          <DetailRow
            label="Largest Missed Move"
            value={largest_missed_move ? `${largest_missed_move.ticker} (${largest_missed_move.trade_date})` : NA}
          />
        </Section>

        <Section title="Setup / Structure / Entry-Taktik">
          {setup_breakdown.by_setup.map((g) => (
            <DetailRow key={g.value} label={`Setup: ${g.value}`} value={`${g.count}x · ${fmt(g.avg_dollar)} avg`} />
          ))}
          {setup_breakdown.by_structure.map((g) => (
            <DetailRow key={g.value} label={`Structure: ${g.value}`} value={`${g.count}x · ${fmt(g.avg_dollar)} avg`} />
          ))}
          {setup_breakdown.by_entry_tactic.map((g) => (
            <DetailRow key={g.value} label={`Entry-Taktik: ${g.value}`} value={`${g.count}x · ${fmt(g.avg_dollar)} avg`} />
          ))}
        </Section>

        <Section title="Cooldown / Anti-Hot-Hand">
          {cooldown.available ? (
            cooldown.groups.map((g) => (
              <DetailRow
                key={g.label}
                label={g.label === "after_winner" ? "Nach Gewinner" : "Nach Verlierer"}
                value={`${g.entry_count} Entries · ${pct(g.win_rate_pct)} WR · ${fmt(g.avg_dollar)} avg`}
              />
            ))
          ) : (
            <Text style={styles.paragraph}>{cooldown.note}</Text>
          )}
        </Section>
      </Page>

      <Page size="A4" style={styles.page}>
        <Section title="Diagnostic Checks">
          {diagnostics.map((d) => (
            <DetailRow
              key={d.check_id}
              label={`[${d.category}] ${d.label}`}
              value={d.triggered === null ? NA : d.triggered ? "auffällig" : "unauffällig"}
            />
          ))}
        </Section>

        <Section title="Repetition / Problem Loops">
          {repetition.problem_loops.length === 0 && repetition.recurring_positives.length === 0 ? (
            <Text style={styles.paragraph}>Noch nicht genug Wochenhistorie oder keine Muster erkannt.</Text>
          ) : (
            <>
              {repetition.problem_loops.map((p) => (
                <DetailRow key={p.label} label={p.label} value={`${p.weeks_seen}/${p.weeks_checked} Wochen`} />
              ))}
              {repetition.recurring_positives.map((p) => (
                <DetailRow key={p.label} label={p.label} value={`${p.weeks_seen}/${p.weeks_checked} Wochen`} />
              ))}
            </>
          )}
        </Section>

        <Section title="Pattern / State Analysis">
          {state_analysis.map((s) => (
            <DetailRow key={s.state} label={s.state} value={`${s.day_count}d · ${fmt(s.avg_dollar)} avg · ${pct(s.win_rate_pct)} WR`} />
          ))}
        </Section>

        <Section title="Weekly Interpretation">
          {manual.preconditions_note ? <Text style={styles.paragraph}>Preconditions: {manual.preconditions_note}</Text> : null}
          {manual.worked ? <Text style={styles.paragraph}>Worked: {manual.worked}</Text> : null}
          {manual.not_worked ? <Text style={styles.paragraph}>Not Worked: {manual.not_worked}</Text> : null}
          {manual.continue_doing ? <Text style={styles.paragraph}>Weiter so: {manual.continue_doing}</Text> : null}
          {manual.improve ? <Text style={styles.paragraph}>Verbessern: {manual.improve}</Text> : null}
          {manual.eliminate ? <Text style={styles.paragraph}>Eliminieren: {manual.eliminate}</Text> : null}
          {manual.next_week_changes ? <Text style={styles.paragraph}>Nächste Woche: {manual.next_week_changes}</Text> : null}
          <DetailRow label="Process Grade" value={manual.process_grade ?? "–"} />
          {manual.process_grade_reason ? <Text style={styles.paragraph}>Begründung: {manual.process_grade_reason}</Text> : null}
        </Section>
      </Page>
    </Document>
  );
}
