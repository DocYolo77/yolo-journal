/* eslint-disable jsx-a11y/alt-text -- @react-pdf/renderer's Image is a
   PDF-native primitive, not an HTML <img>; it has no `alt` prop and
   eslint-plugin-jsx-a11y can't tell the two apart. */
import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { DailyReviewData } from "@/lib/data/daily-review";
import type { ShadowlistEntry } from "@/lib/data/shadowlist";
import { DAILY_REVIEW_GUARDRAILS, GUARDRAIL_STATUS_LABELS } from "@/lib/validation/daily-review";

// §5.1 — "Archivformat, unverändert im Charakter zu bisher." Same
// @react-pdf/renderer approach as the Weekly Report PDF
// (lib/reports/weekly-pdf-document.tsx): deterministic rendering, no
// LLM, no headless browser. Unlike the pre-v2 Daily Report this has no
// separate finalized-snapshot table behind it — the Daily Review is
// always editable, and "Das PDF ist der Snapshot" (§1.4): every export
// reflects the live data at export time.

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: "Helvetica", backgroundColor: "#0a0a0c", color: "#f4f4f5" },
  h1: { fontSize: 16, marginBottom: 2 },
  meta: { fontSize: 8, color: "#9a9aa4", marginBottom: 14 },
  section: { marginBottom: 10, padding: 8, borderWidth: 1, borderColor: "#232328", borderRadius: 4 },
  sectionTitle: { fontSize: 10, marginBottom: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  label: { color: "#9a9aa4" },
  value: { color: "#f4f4f5" },
  paragraph: { color: "#f4f4f5", marginTop: 2, marginBottom: 4, lineHeight: 1.4 },
  chartImage: { width: "100%", marginTop: 6, marginBottom: 6 },
  tableHeader: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#232328", paddingBottom: 3, marginBottom: 3 },
  tableRow: { flexDirection: "row", paddingVertical: 2 },
  cell: { flex: 1, color: "#f4f4f5" },
  cellLabel: { flex: 1, color: "#9a9aa4" },
  tradeCard: { marginBottom: 8, padding: 6, borderWidth: 1, borderColor: "#232328", borderRadius: 3 },
  tradeTicker: { fontSize: 10, marginBottom: 3 },
});

const NA = "n/v";

function fmt(value: number | null, digits = 2): string {
  return value == null ? "–" : value.toLocaleString("de-DE", { maximumFractionDigits: digits });
}

function pct(value: number | null): string {
  return value == null ? NA : `${fmt(value, 1)}%`;
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

function formatGermanDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}.${month}.${year}`;
}

export function DailyReviewPdfDocument({
  data,
  shadowlist,
  chartImages,
}: {
  data: DailyReviewData;
  shadowlist: ShadowlistEntry[];
  chartImages: { ticker: string; dataUri: string }[];
}) {
  const { review, watchlistToday, watchlistNext, trades, guardrails } = data;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Daily Review — {formatGermanDate(review.trade_date)}</Text>
        <Text style={styles.meta}>Erzeugt am {new Date().toLocaleString("de-DE")}</Text>

        <Section title="Kopf">
          {review.risk_pct != null ? <DetailRow label="Risk %" value={fmt(review.risk_pct)} /> : null}
          {review.r_value_usd != null ? <DetailRow label="1R USD" value={fmt(review.r_value_usd)} /> : null}
          {review.nlv_close != null ? <DetailRow label="NLV Close" value={fmt(review.nlv_close)} /> : null}
          {watchlistToday.length > 0 ? (
            <DetailRow label="Watchlist" value={watchlistToday.map((w) => w.ticker).join(", ")} />
          ) : null}
        </Section>

        {review.market_context || review.personal_state || review.focus_level != null ? (
          <Section title="Kontext">
            {review.market_context ? <Text style={styles.paragraph}>Marktumgebung: {review.market_context}</Text> : null}
            {review.personal_state ? <Text style={styles.paragraph}>Persönliche Lage / Mentales: {review.personal_state}</Text> : null}
            {review.focus_level != null ? <DetailRow label="Fokus" value={`${fmt(review.focus_level, 1)}/5`} /> : null}
          </Section>
        ) : null}

        {review.gameplan ? (
          <Section title="Gameplan">
            <Text style={styles.paragraph}>{review.gameplan}</Text>
          </Section>
        ) : null}

        {trades.filter((t) => t.ticker.trim() !== "").length > 0 ? (
          <Section title="Trades">
            {trades
              .filter((t) => t.ticker.trim() !== "")
              .map((t) => (
                <View key={t.id} style={styles.tradeCard}>
                  <Text style={styles.tradeTicker}>{t.ticker}</Text>
                  {t.setup ? <Text style={styles.paragraph}>Setup: {t.setup}</Text> : null}
                  {t.trigger_tactic ? <Text style={styles.paragraph}>Trigger / Taktik: {t.trigger_tactic}</Text> : null}
                  {t.stop_logic ? <Text style={styles.paragraph}>Stop-Logik: {t.stop_logic}</Text> : null}
                  {t.what_happened ? <Text style={styles.paragraph}>Verlauf: {t.what_happened}</Text> : null}
                  {t.my_thinking ? <Text style={styles.paragraph}>Meine Denke: {t.my_thinking}</Text> : null}
                </View>
              ))}
          </Section>
        ) : null}

        {shadowlist.length > 0 ? (
          <Section title="Shadowlist">
            <View style={styles.tableHeader}>
              <Text style={styles.cellLabel}>Ticker</Text>
              <Text style={styles.cellLabel}>Close</Text>
              <Text style={styles.cellLabel}>Tag</Text>
              <Text style={styles.cellLabel}>5 Tage</Text>
              <Text style={styles.cellLabel}>Genommen</Text>
            </View>
            {shadowlist.map((entry) => (
              <View key={entry.id} style={styles.tableRow}>
                <Text style={styles.cell}>{entry.ticker}</Text>
                <Text style={styles.cell}>{fmt(entry.close)}</Text>
                <Text style={styles.cell}>{pct(entry.dayMovePct)}</Text>
                <Text style={styles.cell}>{pct(entry.fiveDayMovePct)}</Text>
                <Text style={styles.cell}>{entry.taken ? "Ja" : "Nein"}</Text>
              </View>
            ))}
          </Section>
        ) : null}
      </Page>

      {chartImages.length > 0 ? (
        <Page size="A4" style={styles.page}>
          <Section title="Charts">
            {chartImages.map((c) => (
              <View key={c.ticker}>
                <Text style={styles.label}>{c.ticker}</Text>
                <Image src={c.dataUri} style={styles.chartImage} />
              </View>
            ))}
          </Section>
        </Page>
      ) : null}

      <Page size="A4" style={styles.page}>
        {review.what_went_well || review.what_went_wrong || review.what_to_improve || review.self_grade ? (
          <Section title="Fazit">
            {review.what_went_well ? <Text style={styles.paragraph}>Gut: {review.what_went_well}</Text> : null}
            {review.what_went_wrong ? <Text style={styles.paragraph}>Nicht gut: {review.what_went_wrong}</Text> : null}
            {review.what_to_improve ? <Text style={styles.paragraph}>Besser: {review.what_to_improve}</Text> : null}
            {review.self_grade ? <DetailRow label="Self Grade" value={review.self_grade} /> : null}
          </Section>
        ) : null}

        {guardrails.length > 0 || review.guardrails_note ? (
          <Section title="Guardrails">
            {guardrails.map((g) => {
              const label = DAILY_REVIEW_GUARDRAILS.find((d) => d.key === g.guardrail_key)?.label ?? g.guardrail_key;
              return (
                <DetailRow
                  key={g.id}
                  label={label}
                  value={`${GUARDRAIL_STATUS_LABELS[g.status]}${g.notes ? ` — ${g.notes}` : ""}`}
                />
              );
            })}
            {review.guardrails_note ? <Text style={styles.paragraph}>{review.guardrails_note}</Text> : null}
          </Section>
        ) : null}

        {watchlistNext.length > 0 || review.next_session_plan ? (
          <Section title="Plan für die nächste Session">
            {watchlistNext.length > 0 ? (
              <DetailRow label="Watchlist" value={watchlistNext.map((w) => w.ticker).join(", ")} />
            ) : null}
            {review.next_session_plan ? <Text style={styles.paragraph}>{review.next_session_plan}</Text> : null}
          </Section>
        ) : null}
      </Page>
    </Document>
  );
}
