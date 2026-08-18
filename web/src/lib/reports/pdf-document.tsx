/* eslint-disable jsx-a11y/alt-text -- @react-pdf/renderer's Image is a
   PDF-native primitive, not an HTML <img>; it has no `alt` prop and
   eslint-plugin-jsx-a11y can't tell the two apart. */
import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { DailyReportSnapshotData } from "@/lib/supabase/types";

// Deterministic PDF rendering of the same finalized snapshot the web
// report renders — no LLM, no headless browser: @react-pdf/renderer is
// pure JS/React, well-supported on Vercel serverless. Charts are the
// exact same SVGs as the web view, rasterized to PNG (see
// rasterize-svg.ts) since react-pdf has no reliable raw-SVG embedding.

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: "Helvetica", backgroundColor: "#0a0a0c", color: "#f4f4f5" },
  h1: { fontSize: 16, marginBottom: 2 },
  meta: { fontSize: 8, color: "#9a9aa4", marginBottom: 14 },
  section: { marginBottom: 12, padding: 8, borderWidth: 1, borderColor: "#232328", borderRadius: 4 },
  sectionTitle: { fontSize: 10, marginBottom: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  label: { color: "#9a9aa4" },
  value: { color: "#f4f4f5" },
  paragraph: { color: "#9a9aa4", marginTop: 4, lineHeight: 1.4 },
  chartImage: { width: "100%", marginTop: 6, marginBottom: 6 },
  tickerBlock: { marginBottom: 8, padding: 6, borderWidth: 1, borderColor: "#232328", borderRadius: 4 },
  tableHeader: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#232328", paddingBottom: 3, marginBottom: 3 },
  tableRow: { flexDirection: "row", paddingVertical: 2 },
  cell: { flex: 1, color: "#f4f4f5" },
  cellLabel: { flex: 1, color: "#9a9aa4" },
});

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

export type ChartImages = {
  indexCharts: { ticker: string; dataUri: string }[];
  tickerCharts: { ticker: string; dailyDataUri: string; intradayDataUri: string }[];
};

function fmt(value: number | null): string {
  return value == null ? "–" : value.toLocaleString("de-DE", { maximumFractionDigits: 2 });
}

function fmtDT(value: string | null): string {
  return value ? new Date(value).toLocaleString("de-DE") : "–";
}

export function DailyReportPdfDocument({
  snapshot,
  chartImages,
}: {
  snapshot: DailyReportSnapshotData;
  chartImages: ChartImages;
}) {
  const { review, commitment, shadowlist } = snapshot;
  const campaigns = snapshot.campaigns ?? [];
  const portfolioPositions = snapshot.portfolio_snapshot?.positions ?? [];
  const portfolioCapturedAt = snapshot.portfolio_snapshot?.captured_at ?? null;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Daily Report — {snapshot.trade_date}</Text>
        <Text style={styles.meta}>
          Finalisiert am {new Date(snapshot.created_at).toLocaleString("de-DE")} · Schema v
          {snapshot.report_schema_version}
        </Text>

        <Section title="Portfolio">
          <DetailRow label="NLV / Portfolio Value" value={fmt(review.net_liquidation_value)} />
          <DetailRow label="Daily P&L" value={fmt(review.daily_pnl)} />
          {snapshot.broker_account_snapshot ? (
            <DetailRow
              label="Broker-Snapshot"
              value={
                fmt(snapshot.broker_account_snapshot.net_liquidation_value) +
                (snapshot.broker_account_snapshot.trading_date &&
                snapshot.broker_account_snapshot.trading_date !== snapshot.trade_date
                  ? ` (IBKR-Stand vom ${snapshot.broker_account_snapshot.trading_date})`
                  : "")
              }
            />
          ) : (
            <DetailRow label="Broker-Snapshot" value="keine Broker-Daten für diesen Tag" />
          )}
        </Section>

        <Section title="Campaigns — Entry-Daten (IBKR)">
          {campaigns.length > 0 ? (
            campaigns.map((c) => (
              <View key={c.id} style={styles.tickerBlock}>
                <Text style={styles.sectionTitle}>
                  {c.symbol} · {c.direction ?? "–"} · {c.status}
                  {c.realized_pnl != null ? ` · Realized ${fmt(c.realized_pnl)}` : ""}
                </Text>
                <View style={styles.tableHeader}>
                  <Text style={styles.cellLabel}>Zeit</Text>
                  <Text style={styles.cellLabel}>Seite</Text>
                  <Text style={styles.cellLabel}>Preis</Text>
                  <Text style={styles.cellLabel}>Menge</Text>
                </View>
                {c.fills.map((f, i) => (
                  <View key={i} style={styles.tableRow}>
                    <Text style={styles.cell}>{fmtDT(f.executed_at)}</Text>
                    <Text style={styles.cell}>{f.side}</Text>
                    <Text style={styles.cell}>{fmt(f.price)}</Text>
                    <Text style={styles.cell}>{String(f.quantity)}</Text>
                  </View>
                ))}
              </View>
            ))
          ) : (
            <Text style={styles.paragraph}>Keine Campaigns für diesen Tag synchronisiert.</Text>
          )}
        </Section>

        <Section title="Portfolio-Snapshot (IBKR, inkl. Altpositionen)">
          {portfolioPositions.length > 0 ? (
            <>
              <Text style={styles.label}>Stand {fmtDT(portfolioCapturedAt)}</Text>
              <View style={styles.tableHeader}>
                <Text style={styles.cellLabel}>Ticker</Text>
                <Text style={styles.cellLabel}>Menge</Text>
                <Text style={styles.cellLabel}>Ø Entry</Text>
                <Text style={styles.cellLabel}>Marktpreis</Text>
                <Text style={styles.cellLabel}>Unrealized P&L</Text>
              </View>
              {portfolioPositions.map((p) => (
                <View key={p.symbol} style={styles.tableRow}>
                  <Text style={styles.cell}>{p.symbol}</Text>
                  <Text style={styles.cell}>{String(p.quantity)}</Text>
                  <Text style={styles.cell}>{fmt(p.average_price)}</Text>
                  <Text style={styles.cell}>{fmt(p.market_price)}</Text>
                  <Text style={styles.cell}>{fmt(p.unrealized_pnl)}</Text>
                </View>
              ))}
            </>
          ) : (
            <Text style={styles.paragraph}>Kein Portfolio-Snapshot für diesen Tag verfügbar.</Text>
          )}
        </Section>

        <Section title="Markt-Review">
          <DetailRow label="Review Type" value={review.review_type ?? "–"} />
          {review.market_thought ? <Text style={styles.paragraph}>{review.market_thought}</Text> : null}
          {review.market_environment ? <Text style={styles.paragraph}>{review.market_environment}</Text> : null}
          {chartImages.indexCharts.map((chart) => (
            <View key={chart.ticker}>
              <Text style={styles.label}>{chart.ticker}</Text>
              <Image src={chart.dataUri} style={styles.chartImage} />
            </View>
          ))}
        </Section>

        <Section title="Commitment-Zusammenfassung">
          {commitment ? (
            <>
              <DetailRow label="Status" value={commitment.status} />
              <DetailRow
                label="Committed-Risiko"
                value={commitment.committed_risk_pct != null ? `${commitment.committed_risk_pct}%` : "–"}
              />
              <DetailRow
                label="Intraday-Risiko (final)"
                value={commitment.intraday_risk_pct != null ? `${commitment.intraday_risk_pct}%` : "–"}
              />
              {commitment.market_state_note ? (
                <Text style={styles.paragraph}>{commitment.market_state_note}</Text>
              ) : null}
            </>
          ) : (
            <Text style={styles.paragraph}>Kein gelocktes Commitment für diesen Tag (reconstructed).</Text>
          )}
        </Section>

        <Section title="Shadowlist / Selection Audit">
          {shadowlist.length > 0 ? (
            <>
              <View style={styles.tableHeader}>
                <Text style={styles.cellLabel}>Ticker</Text>
                <Text style={styles.cellLabel}>Liste</Text>
                <Text style={styles.cellLabel}>Entscheidung</Text>
                <Text style={styles.cellLabel}>Grund</Text>
              </View>
              {shadowlist.map((s) => (
                <View key={s.id} style={styles.tableRow}>
                  <Text style={styles.cell}>{s.ticker}</Text>
                  <Text style={styles.cell}>{s.list_type}</Text>
                  <Text style={styles.cell}>{s.decision}</Text>
                  <Text style={styles.cell}>{s.reason ?? "–"}</Text>
                </View>
              ))}
            </>
          ) : (
            <Text style={styles.paragraph}>Keine Shadowlist-Einträge.</Text>
          )}
          {review.shadowlist_comment ? (
            <Text style={styles.paragraph}>Stellungnahme: {review.shadowlist_comment}</Text>
          ) : null}
        </Section>

        <Section title="Guardrails">
          {review.guardrails.map((g) => (
            <DetailRow key={g.guardrail_id} label={g.guardrail} value={g.status || "–"} />
          ))}
        </Section>

        <Section title="Mental / Coaching">
          <DetailRow label="Mental States" value={review.mental.states.join(", ") || "–"} />
          <DetailRow label="Focus (1-5)" value={review.mental.focus != null ? String(review.mental.focus) : "–"} />
          <DetailRow label="Self Grade" value={review.self_grade || "–"} />
          {review.positive ? <Text style={styles.paragraph}>Positive: {review.positive}</Text> : null}
          {review.weakness ? <Text style={styles.paragraph}>Weakness: {review.weakness}</Text> : null}
          {review.coaching_take ? (
            <Text style={styles.paragraph}>Coaching Take: {review.coaching_take}</Text>
          ) : null}
        </Section>

        <Section title="Was willst du konkret verbessern?">
          {review.operational_todos.length > 0 ? (
            review.operational_todos.map((todo, i) => (
              <Text key={i} style={styles.paragraph}>
                • {todo}
              </Text>
            ))
          ) : (
            <Text style={styles.paragraph}>Keine Verbesserungspunkte erfasst.</Text>
          )}
        </Section>
      </Page>

      {review.ticker_reviews.length > 0 ? (
        <Page size="A4" style={styles.page}>
          <Text style={styles.h1}>Ticker Reviews — {snapshot.trade_date}</Text>
          {review.ticker_reviews.map((t) => {
            const chart = chartImages.tickerCharts.find((c) => c.ticker === t.ticker);
            return (
              <View key={t.ticker} style={styles.tickerBlock}>
                <Text style={styles.sectionTitle}>{t.ticker}</Text>
                <DetailRow label="Setup" value={t.setup || "–"} />
                <DetailRow label="Entry-Taktik" value={t.entry_tactic || "–"} />
                <DetailRow
                  label="Stop Placement"
                  value={
                    t.stop_placement
                      ? t.stop_placement === "%-Stop" && t.stop_placement_pct != null
                        ? `${t.stop_placement} (${t.stop_placement_pct}%)`
                        : t.stop_placement
                      : "–"
                  }
                />
                <DetailRow label="Structure" value={t.structure || "–"} />
                <DetailRow label="Structure Rating" value={t.structure_rating || "–"} />
                <DetailRow label="Management Grade" value={t.management_grade || "–"} />
                <DetailRow label="Rule Status" value={t.rule_status || "–"} />
                <DetailRow label="Exit Setup" value={t.exit_setup || "–"} />
                <DetailRow label="Exit Taktik" value={t.exit_tactic || "–"} />
                {t.thesis ? <Text style={styles.paragraph}>Thesis: {t.thesis}</Text> : null}
                {t.notes ? <Text style={styles.paragraph}>Outcome D0 / Notes: {t.notes}</Text> : null}
                {chart ? (
                  <>
                    <Image src={chart.dailyDataUri} style={styles.chartImage} />
                    <Image src={chart.intradayDataUri} style={styles.chartImage} />
                  </>
                ) : null}
              </View>
            );
          })}
        </Page>
      ) : null}
    </Document>
  );
}
