import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { getReportSnapshot } from "@/lib/data/report-snapshot";
import { renderDailyChartSvg, renderIntradayChartSvg } from "@/lib/charts/svg-chart";
import { isValidTradeDate } from "@/lib/trade-date";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";
import type { TickerChartData } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function DailyReportPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;

  if (!isValidTradeDate(date)) {
    return (
      <div>
        <PageHeader title="Daily Report" description="Ungültiges Datum." />
      </div>
    );
  }

  const result = await getReportSnapshot(date);

  if (!result.data) {
    return (
      <div>
        <PageHeader title="Daily Report" description={date} />
        <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          {result.error ?? "Für dieses Datum wurde noch kein Report finalisiert."}{" "}
          <Link href={`/daily-review?date=${date}`} className="text-accent hover:underline">
            Zum Daily Review
          </Link>
        </div>
      </div>
    );
  }

  const snapshot = result.data.snapshot;
  const { review, commitment, shadowlist, broker_account_snapshot, market_data } = snapshot;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Daily Report — ${snapshot.trade_date}`}
        description={`Finalisiert am ${formatDateTime(snapshot.created_at)} · Schema v${snapshot.report_schema_version}`}
      />

      <div className="flex flex-wrap gap-3">
        <a
          href={`/reports/daily/${date}/pdf`}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
        >
          PDF herunterladen
        </a>
        <a
          href={`/reports/daily/${date}/json`}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
        >
          JSON herunterladen
        </a>
      </div>

      <Section title="Portfolio">
        <DetailGrid
          items={[
            ["NLV / Portfolio Value", formatCurrency(review.net_liquidation_value)],
            ["Daily P&L", formatCurrency(review.daily_pnl)],
            [
              "Broker-Snapshot",
              broker_account_snapshot
                ? `${formatCurrency(broker_account_snapshot.net_liquidation_value)} (erfasst ${formatDateTime(broker_account_snapshot.captured_at)})`
                : "keine Broker-Daten für diesen Tag",
            ],
          ]}
        />
      </Section>

      <Section title="Markt-Review">
        <DetailGrid items={[["Review Type", review.review_type ?? "–"]]} />
        {review.market_thought ? <p className="text-sm text-muted-foreground">{review.market_thought}</p> : null}
        {review.market_environment ? (
          <p className="text-sm text-muted-foreground">{review.market_environment}</p>
        ) : null}
        {market_data.index_context.map((idx) => (
          <div key={idx.ticker} className="mt-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground">{idx.ticker}</p>
            <InlineSvg svg={renderDailyChartSvg(idx.ticker, idx.daily)} />
          </div>
        ))}
        {market_data.fetch_error ? (
          <p className="mt-2 rounded-md border border-negative/40 bg-negative/10 px-3 py-2 text-xs text-negative">
            Marktdaten konnten nicht vollständig geladen werden: {market_data.fetch_error}
          </p>
        ) : null}
      </Section>

      <Section title="Commitment-Zusammenfassung">
        {commitment ? (
          <>
            <DetailGrid
              items={[
                ["Status", commitment.status],
                ["Committed-Risiko", commitment.committed_risk_pct != null ? `${commitment.committed_risk_pct}%` : "–"],
                [
                  "Intraday-Risiko (final)",
                  commitment.intraday_risk_pct != null ? `${commitment.intraday_risk_pct}%` : "–",
                ],
                ["QQQ ATR-Multiple", formatNumber(commitment.qqq_extension_atr_multiple)],
                ["SPY ATR-Multiple", formatNumber(commitment.spy_extension_atr_multiple)],
              ]}
            />
            {commitment.market_state_note ? (
              <p className="text-sm text-muted-foreground">{commitment.market_state_note}</p>
            ) : null}
            <div className="mt-2 space-y-1">
              {commitment.watchlist.map((w) => (
                <div key={w.id} className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-foreground">{w.ticker}</span>
                  <span className="text-xs text-muted-foreground">{w.list_type}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Kein gelocktes Commitment für diesen Tag (reconstructed).
          </p>
        )}
      </Section>

      <Section title="Shadowlist / Selection Audit">
        {shadowlist.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="py-2 pr-4">Ticker</th>
                <th className="py-2 pr-4">Liste</th>
                <th className="py-2 pr-4">Entscheidung</th>
                <th className="py-2 pr-4">Grund</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shadowlist.map((s) => (
                <tr key={s.id}>
                  <td className="py-2 pr-4 font-medium text-foreground">{s.ticker}</td>
                  <td className="py-2 pr-4 text-muted-foreground">{s.list_type}</td>
                  <td className="py-2 pr-4 text-foreground">{s.decision}</td>
                  <td className="py-2 pr-4 text-muted-foreground">{s.reason ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted-foreground">Keine Shadowlist-Einträge.</p>
        )}
      </Section>

      <Section title="Ticker Reviews">
        {review.ticker_reviews.length > 0 ? (
          <div className="space-y-6">
            {review.ticker_reviews.map((t) => {
              const chart: TickerChartData | undefined = market_data.tickers.find((m) => m.ticker === t.ticker);
              return (
                <div key={t.ticker} className="rounded-md border border-border p-3">
                  <h3 className="mb-2 text-sm font-semibold text-foreground">{t.ticker}</h3>
                  <DetailGrid
                    items={[
                      ["Setup", t.setup || "–"],
                      ["Trigger", t.trigger || "–"],
                      ["Structure", t.structure || "–"],
                      ["Structure Rating", t.structure_rating || "–"],
                      ["Management Grade", t.management_grade || "–"],
                      ["Rule Status", t.rule_status || "–"],
                    ]}
                  />
                  {t.thesis ? <p className="mt-2 text-sm text-muted-foreground">Thesis: {t.thesis}</p> : null}
                  {t.intended_stop_logic ? (
                    <p className="text-sm text-muted-foreground">Stop-Logik: {t.intended_stop_logic}</p>
                  ) : null}
                  {t.management_intent ? (
                    <p className="text-sm text-muted-foreground">Management Intent: {t.management_intent}</p>
                  ) : null}
                  {t.notes ? <p className="text-sm text-muted-foreground">Notes: {t.notes}</p> : null}

                  {chart ? (
                    <div className="mt-3 space-y-3">
                      <InlineSvg svg={renderDailyChartSvg(t.ticker, chart.daily)} />
                      <InlineSvg
                        svg={renderIntradayChartSvg(t.ticker, chart.intraday, chart.orb_levels, chart.markers)}
                      />
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">Keine Chart-Daten für diesen Ticker.</p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Keine Ticker-Reviews erfasst.</p>
        )}
      </Section>

      <Section title="Guardrails">
        <div className="space-y-1">
          {review.guardrails.map((g) => (
            <div key={g.guardrail_id} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-foreground">{g.guardrail}</span>
              <span
                className={
                  g.status === "Eingehalten"
                    ? "text-positive"
                    : g.status === "Verletzt"
                      ? "text-negative"
                      : "text-muted-foreground"
                }
              >
                {g.status || "–"}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Mental / Coaching">
        <DetailGrid
          items={[
            ["Mental States", review.mental.states.join(", ") || "–"],
            ["Focus (1-5)", review.mental.focus != null ? String(review.mental.focus) : "–"],
            ["Influence", review.mental.influence || "–"],
            ["Self Grade", review.self_grade || "–"],
          ]}
        />
        {review.positive ? <p className="text-sm text-muted-foreground">Positive: {review.positive}</p> : null}
        {review.weakness ? <p className="text-sm text-muted-foreground">Weakness: {review.weakness}</p> : null}
        {review.coaching_take ? (
          <p className="text-sm text-muted-foreground">Coaching Take: {review.coaching_take}</p>
        ) : null}
        {review.operational_todos.length > 0 ? (
          <ul className="list-inside list-disc text-sm text-muted-foreground">
            {review.operational_todos.map((todo, i) => (
              <li key={i}>{todo}</li>
            ))}
          </ul>
        ) : null}
      </Section>
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
    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
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

