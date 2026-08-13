"use client";

import { useActionState, useEffect } from "react";
import {
  ASSET_CLASSES,
  DIRECTIONS,
  emptyTradeFormState,
  STATUSES,
  type TradeFormState,
  type TradeFormValues,
} from "@/lib/validation/trade";
import {
  FieldDateTime,
  FieldNumber,
  FieldSelect,
  FieldText,
  FieldTextarea,
} from "@/components/ui/form-fields";

const ASSET_CLASS_LABELS: Record<string, string> = {
  stock: "Stock",
  etf: "ETF",
  option: "Option",
  future: "Future",
  forex: "Forex",
  crypto: "Crypto",
  index: "Index",
  other: "Other",
};

const STATUS_LABELS: Record<string, string> = {
  planned: "Planned",
  open: "Open",
  closed: "Closed",
  cancelled: "Cancelled",
};

type Option = { id: string; name: string };

export function TradeForm({
  action,
  accounts,
  strategies,
  initialValues,
  submitLabel,
  includeClosedAt = false,
  onSuccess,
}: {
  action: (state: TradeFormState, formData: FormData) => Promise<TradeFormState>;
  accounts: Option[];
  strategies: Option[];
  initialValues?: Partial<TradeFormValues>;
  submitLabel: string;
  includeClosedAt?: boolean;
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, emptyTradeFormState);

  useEffect(() => {
    if (state.success) {
      onSuccess?.();
    }
    // Only react to the action's own success signal, not to identity
    // changes of the onSuccess callback passed in by the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  const errors = state.fieldErrors;
  const v = initialValues ?? {};

  return (
    <form action={formAction} className="space-y-6">
      {state.formError ? (
        <p className="rounded-md border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-negative">
          {state.formError}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <FieldText name="symbol" label="Symbol" defaultValue={v.symbol} error={errors.symbol} required />
        <FieldSelect
          name="direction"
          label="Direction"
          defaultValue={v.direction}
          error={errors.direction}
          required
          placeholder="Bitte wählen"
          options={DIRECTIONS.map((d) => ({ value: d, label: d === "long" ? "Long" : "Short" }))}
        />
        <FieldSelect
          name="assetClass"
          label="Asset Class"
          defaultValue={v.assetClass ?? "stock"}
          error={errors.assetClass}
          required
          placeholder="Bitte wählen"
          options={ASSET_CLASSES.map((a) => ({ value: a, label: ASSET_CLASS_LABELS[a] }))}
        />
        <FieldSelect
          name="status"
          label="Status"
          defaultValue={v.status ?? "open"}
          error={errors.status}
          required
          placeholder="Bitte wählen"
          options={STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
        />
        <FieldSelect
          name="accountId"
          label="Account"
          defaultValue={v.accountId}
          error={errors.accountId}
          placeholder={accounts.length ? "Kein Account" : "Noch keine Accounts angelegt"}
          options={accounts.map((a) => ({ value: a.id, label: a.name }))}
        />
        <FieldSelect
          name="strategyId"
          label="Strategy"
          defaultValue={v.strategyId}
          error={errors.strategyId}
          placeholder={strategies.length ? "Keine Strategy" : "Noch keine Strategien angelegt"}
          options={strategies.map((s) => ({ value: s.id, label: s.name }))}
        />
        <FieldDateTime name="openedAt" label="Opened At" defaultValue={v.openedAt} error={errors.openedAt} />
        {includeClosedAt ? (
          <FieldDateTime name="closedAt" label="Closed At" defaultValue={v.closedAt} error={errors.closedAt} />
        ) : null}
        <FieldNumber name="plannedEntry" label="Planned Entry" defaultValue={v.plannedEntry} error={errors.plannedEntry} />
        <FieldNumber name="initialStop" label="Initial Stop" defaultValue={v.initialStop} error={errors.initialStop} />
        <FieldNumber
          name="initialRiskAmount"
          label="Initial Risk Amount"
          defaultValue={v.initialRiskAmount}
          error={errors.initialRiskAmount}
          min={0}
        />
        <FieldNumber
          name="initialRiskPct"
          label="Initial Risk %"
          defaultValue={v.initialRiskPct}
          error={errors.initialRiskPct}
          min={0}
        />
      </div>

      <FieldTextarea name="thesis" label="Thesis" defaultValue={v.thesis} error={errors.thesis} />
      <FieldTextarea name="notes" label="Notes" defaultValue={v.notes} error={errors.notes} />

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90 disabled:opacity-60"
        >
          {pending ? "Speichern…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
