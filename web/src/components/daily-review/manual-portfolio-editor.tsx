"use client";

import type { ManualPortfolioPosition } from "@/lib/supabase/types";
import { formatCurrency } from "@/lib/format";

const inputClass =
  "rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none";

function emptyRow(): ManualPortfolioPosition {
  return { symbol: "", quantity: 0, average_price: null, market_price: null, unrealized_pnl: null, currency: "USD" };
}

/**
 * Manual override for the Portfolio position table — for when the
 * automatic IBKR sync doesn't reflect the real portfolio correctly.
 * unrealized_pnl is always derived from average_price/market_price/
 * quantity here (not independently editable), same math as the
 * read-only IBKR-synced table, so the two never disagree with each
 * other over what "PNL $" means.
 */
export function ManualPortfolioEditor({
  value,
  onChange,
}: {
  value: ManualPortfolioPosition[];
  onChange: (rows: ManualPortfolioPosition[]) => void;
}) {
  function updateRow(index: number, patch: Partial<ManualPortfolioPosition>) {
    onChange(
      value.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, ...patch };
        next.unrealized_pnl =
          next.average_price != null && next.market_price != null
            ? (next.market_price - next.average_price) * next.quantity
            : null;
        return next;
      })
    );
  }

  function removeRow(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function addRow() {
    onChange([...value, emptyRow()]);
  }

  return (
    <div className="space-y-3">
      {value.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="py-2 pr-4">Ticker</th>
                <th className="py-2 pr-4">Einstiegspreis</th>
                <th className="py-2 pr-4">Stückzahl</th>
                <th className="py-2 pr-4">Marktpreis</th>
                <th className="py-2 pr-4">PNL %</th>
                <th className="py-2 pr-4">PNL $</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {value.map((row, index) => {
                const pnlPct =
                  row.average_price && row.market_price
                    ? ((row.market_price - row.average_price) / row.average_price) * 100
                    : null;
                return (
                  <tr key={index}>
                    <td className="py-1.5 pr-4">
                      <input
                        value={row.symbol}
                        onChange={(e) => updateRow(index, { symbol: e.target.value.toUpperCase() })}
                        placeholder="TICKER"
                        className={`w-20 ${inputClass}`}
                      />
                    </td>
                    <td className="py-1.5 pr-4">
                      <input
                        type="number"
                        step="any"
                        value={row.average_price ?? ""}
                        onChange={(e) =>
                          updateRow(index, { average_price: e.target.value === "" ? null : Number(e.target.value) })
                        }
                        className={`w-24 ${inputClass}`}
                      />
                    </td>
                    <td className="py-1.5 pr-4">
                      <input
                        type="number"
                        step="any"
                        value={row.quantity}
                        onChange={(e) => updateRow(index, { quantity: e.target.value === "" ? 0 : Number(e.target.value) })}
                        className={`w-20 ${inputClass}`}
                      />
                    </td>
                    <td className="py-1.5 pr-4">
                      <input
                        type="number"
                        step="any"
                        value={row.market_price ?? ""}
                        onChange={(e) =>
                          updateRow(index, { market_price: e.target.value === "" ? null : Number(e.target.value) })
                        }
                        className={`w-24 ${inputClass}`}
                      />
                    </td>
                    <td
                      className={`py-1.5 pr-4 ${pnlPct != null && pnlPct < 0 ? "text-negative" : "text-positive"}`}
                    >
                      {pnlPct != null ? `${pnlPct.toFixed(2)}%` : "–"}
                    </td>
                    <td
                      className={`py-1.5 pr-4 ${row.unrealized_pnl != null && row.unrealized_pnl < 0 ? "text-negative" : "text-positive"}`}
                    >
                      {formatCurrency(row.unrealized_pnl, row.currency ?? "USD")}
                    </td>
                    <td className="py-1.5">
                      <button
                        type="button"
                        onClick={() => removeRow(index)}
                        className="text-xs text-muted-foreground hover:text-negative"
                      >
                        Entfernen
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Keine manuelle Korrektur — solange hier keine Zeile existiert, gelten die IBKR-Sync-Werte.
        </p>
      )}
      <button type="button" onClick={addRow} className="text-sm text-accent hover:underline">
        + Position hinzufügen
      </button>
    </div>
  );
}
