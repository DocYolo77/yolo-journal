import type { AssetClass, TradeDirection, TradeStatus } from "@/lib/supabase/types";

export const ASSET_CLASSES: AssetClass[] = [
  "stock",
  "etf",
  "option",
  "future",
  "forex",
  "crypto",
  "index",
  "other",
];

export const DIRECTIONS: TradeDirection[] = ["long", "short"];

export const STATUSES: TradeStatus[] = ["planned", "open", "closed", "cancelled"];

export type TradeFormValues = {
  symbol: string;
  direction: string;
  assetClass: string;
  status: string;
  accountId: string;
  strategyId: string;
  openedAt: string;
  closedAt: string;
  plannedEntry: string;
  initialStop: string;
  initialRiskAmount: string;
  initialRiskPct: string;
  thesis: string;
  notes: string;
};

export type TradeInsertInput = {
  symbol: string;
  direction: TradeDirection;
  asset_class: AssetClass;
  status: TradeStatus;
  account_id: string | null;
  strategy_id: string | null;
  opened_at: string | null;
  closed_at: string | null;
  planned_entry: number | null;
  initial_stop: number | null;
  initial_risk_amount: number | null;
  initial_risk_pct: number | null;
  thesis: string | null;
  notes: string | null;
};

export type TradeFormState = {
  fieldErrors: Partial<Record<keyof TradeFormValues, string>>;
  formError?: string;
  success?: boolean;
};

export const emptyTradeFormState: TradeFormState = { fieldErrors: {} };

type TradeValidationResult =
  | { success: true; data: TradeInsertInput }
  | { success: false; fieldErrors: TradeFormState["fieldErrors"]; formError?: string };

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseOptionalNumber(
  raw: string,
  label: string,
  field: keyof TradeFormValues,
  errors: TradeFormState["fieldErrors"],
  min?: number
): number | null {
  if (raw === "") return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    errors[field] = `${label} muss eine Zahl sein.`;
    return null;
  }
  if (min !== undefined && value < min) {
    errors[field] = `${label} darf nicht kleiner als ${min} sein.`;
    return null;
  }
  return value;
}

function parseOptionalDate(
  raw: string,
  label: string,
  field: keyof TradeFormValues,
  errors: TradeFormState["fieldErrors"]
): string | null {
  if (raw === "") return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    errors[field] = `${label} ist kein gültiges Datum.`;
    return null;
  }
  return date.toISOString();
}

export function parseTradeForm(formData: FormData): TradeValidationResult {
  const values: TradeFormValues = {
    symbol: readString(formData, "symbol"),
    direction: readString(formData, "direction"),
    assetClass: readString(formData, "assetClass"),
    status: readString(formData, "status"),
    accountId: readString(formData, "accountId"),
    strategyId: readString(formData, "strategyId"),
    openedAt: readString(formData, "openedAt"),
    closedAt: readString(formData, "closedAt"),
    plannedEntry: readString(formData, "plannedEntry"),
    initialStop: readString(formData, "initialStop"),
    initialRiskAmount: readString(formData, "initialRiskAmount"),
    initialRiskPct: readString(formData, "initialRiskPct"),
    thesis: readString(formData, "thesis"),
    notes: readString(formData, "notes"),
  };

  const fieldErrors: TradeFormState["fieldErrors"] = {};

  if (!values.symbol) {
    fieldErrors.symbol = "Symbol ist erforderlich.";
  }

  if (!DIRECTIONS.includes(values.direction as TradeDirection)) {
    fieldErrors.direction = "Bitte Long oder Short wählen.";
  }

  if (!ASSET_CLASSES.includes(values.assetClass as AssetClass)) {
    fieldErrors.assetClass = "Bitte eine Asset-Klasse wählen.";
  }

  if (!STATUSES.includes(values.status as TradeStatus)) {
    fieldErrors.status = "Bitte einen Status wählen.";
  }

  const plannedEntry = parseOptionalNumber(
    values.plannedEntry,
    "Planned Entry",
    "plannedEntry",
    fieldErrors
  );
  const initialStop = parseOptionalNumber(
    values.initialStop,
    "Initial Stop",
    "initialStop",
    fieldErrors
  );
  const initialRiskAmount = parseOptionalNumber(
    values.initialRiskAmount,
    "Initial Risk Amount",
    "initialRiskAmount",
    fieldErrors,
    0
  );
  const initialRiskPct = parseOptionalNumber(
    values.initialRiskPct,
    "Initial Risk %",
    "initialRiskPct",
    fieldErrors,
    0
  );

  const openedAt = parseOptionalDate(
    values.openedAt,
    "Opened At",
    "openedAt",
    fieldErrors
  );
  const closedAt = parseOptionalDate(
    values.closedAt,
    "Closed At",
    "closedAt",
    fieldErrors
  );

  if (
    !fieldErrors.openedAt &&
    !fieldErrors.closedAt &&
    openedAt &&
    closedAt &&
    closedAt < openedAt
  ) {
    fieldErrors.closedAt = "Closed At darf nicht vor Opened At liegen.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { success: false, fieldErrors };
  }

  return {
    success: true,
    data: {
      symbol: values.symbol.toUpperCase(),
      direction: values.direction as TradeDirection,
      asset_class: values.assetClass as AssetClass,
      status: values.status as TradeStatus,
      account_id: values.accountId || null,
      strategy_id: values.strategyId || null,
      opened_at: openedAt,
      closed_at: closedAt,
      planned_entry: plannedEntry,
      initial_stop: initialStop,
      initial_risk_amount: initialRiskAmount,
      initial_risk_pct: initialRiskPct,
      thesis: values.thesis || null,
      notes: values.notes || null,
    },
  };
}
