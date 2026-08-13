"use client";

import { useState } from "react";
import { TradeForm } from "./trade-form";
import type { TradeDetail } from "@/lib/data/trades";
import type { TradeFormState, TradeFormValues } from "@/lib/validation/trade";
import { formatCurrency, formatDateTime, formatNumber, toDatetimeLocalValue } from "@/lib/format";

type Option = { id: string; name: string };

export function TradeDetailView({
  trade,
  accounts,
  strategies,
  updateAction,
}: {
  trade: TradeDetail;
  accounts: Option[];
  strategies: Option[];
  updateAction: (state: TradeFormState, formData: FormData) => Promise<TradeFormState>;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    const initialValues: Partial<TradeFormValues> = {
      symbol: trade.symbol,
      direction: trade.direction,
      assetClass: trade.asset_class,
      status: trade.status,
      accountId: trade.account_id ?? "",
      strategyId: trade.strategy_id ?? "",
      openedAt: toDatetimeLocalValue(trade.opened_at),
      closedAt: toDatetimeLocalValue(trade.closed_at),
      plannedEntry: trade.planned_entry?.toString() ?? "",
      initialStop: trade.initial_stop?.toString() ?? "",
      initialRiskAmount: trade.initial_risk_amount?.toString() ?? "",
      initialRiskPct: trade.initial_risk_pct?.toString() ?? "",
      thesis: trade.thesis ?? "",
      notes: trade.notes ?? "",
    };

    return (
      <div className="rounded-lg border border-border bg-surface p-4">
        <TradeForm
          action={updateAction}
          accounts={accounts}
          strategies={strategies}
          initialValues={initialValues}
          submitLabel="Änderungen speichern"
          includeClosedAt
          onSuccess={() => setEditing(false)}
        />
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="mt-3 text-sm text-muted-foreground hover:text-foreground"
        >
          Abbrechen
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-surface p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Stammdaten</h2>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-sm text-accent hover:underline"
          >
            Bearbeiten
          </button>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DetailItem label="Symbol" value={trade.symbol} />
          <DetailItem label="Direction" value={trade.direction === "long" ? "Long" : "Short"} />
          <DetailItem label="Asset Class" value={trade.asset_class} />
          <DetailItem label="Status" value={trade.status} />
          <DetailItem label="Account" value={trade.account?.name ?? "–"} />
          <DetailItem label="Strategy" value={trade.strategy?.name ?? "–"} />
          <DetailItem label="Opened At" value={formatDateTime(trade.opened_at)} />
          <DetailItem label="Closed At" value={formatDateTime(trade.closed_at)} />
          <DetailItem label="Planned Entry" value={formatNumber(trade.planned_entry)} />
          <DetailItem label="Initial Stop" value={formatNumber(trade.initial_stop)} />
          <DetailItem label="Initial Risk Amount" value={formatCurrency(trade.initial_risk_amount)} />
          <DetailItem
            label="Initial Risk %"
            value={trade.initial_risk_pct != null ? `${formatNumber(trade.initial_risk_pct)}%` : "–"}
          />
        </dl>
      </section>

      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Thesis</h2>
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{trade.thesis || "–"}</p>
      </section>

      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Notes</h2>
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{trade.notes || "–"}</p>
      </section>

      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Metrics</h2>
        {trade.metrics ? (
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DetailItem label="Avg Entry" value={formatNumber(trade.metrics.avg_entry)} />
            <DetailItem label="Avg Exit" value={formatNumber(trade.metrics.avg_exit)} />
            <DetailItem label="Gross P&L" value={formatCurrency(trade.metrics.gross_pnl)} />
            <DetailItem label="Net P&L" value={formatCurrency(trade.metrics.net_pnl)} />
            <DetailItem
              label="R-Multiple"
              value={trade.metrics.r_multiple != null ? `${formatNumber(trade.metrics.r_multiple)}R` : "–"}
            />
            <DetailItem
              label="Holding"
              value={trade.metrics.holding_minutes != null ? `${trade.metrics.holding_minutes} min` : "–"}
            />
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">Noch keine Metrics berechnet.</p>
        )}
      </section>

      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Executions</h2>
        {trade.executions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4">Side</th>
                  <th className="py-2 pr-4">Zeitpunkt</th>
                  <th className="py-2 pr-4 text-right">Menge</th>
                  <th className="py-2 pr-4 text-right">Preis</th>
                  <th className="py-2 pr-4 text-right">Fees</th>
                  <th className="py-2 pr-4">Notiz</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {trade.executions.map((execution) => (
                  <tr key={execution.id}>
                    <td className="py-2 pr-4 capitalize">{execution.side}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{formatDateTime(execution.executed_at)}</td>
                    <td className="py-2 pr-4 text-right">{formatNumber(execution.quantity)}</td>
                    <td className="py-2 pr-4 text-right">{formatNumber(execution.price)}</td>
                    <td className="py-2 pr-4 text-right">{formatCurrency(execution.fees)}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{execution.notes || "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Noch keine Ausführungen erfasst. Executions folgen in Phase 4.
          </p>
        )}
      </section>

      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Tags</h2>
        {trade.tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {trade.tags.map((tag) => (
              <span key={tag.id} className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                {tag.name}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Keine Tags vergeben.</p>
        )}
      </section>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{value}</dd>
    </div>
  );
}
