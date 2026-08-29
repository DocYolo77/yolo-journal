import type { IbkrJsonAccountSnapshot, IbkrJsonImport } from "./ibkr-json-types";

// Fully deterministic validation — no LLM involved anywhere in this
// file, per the coding instruction's explicit requirement (§16). Errors
// are collected (not fail-fast) and point at the specific field/record,
// e.g. "Execution 4: fx_rate_to_base muss eine Zahl sein." (§14).

export type IbkrJsonValidationResult =
  | { success: true; data: IbkrJsonImport }
  | { success: false; errors: string[] };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumberOrNullish(value: unknown): boolean {
  return value === undefined || value === null || typeof value === "number";
}

function isStringOrNullish(value: unknown): boolean {
  return value === undefined || value === null || typeof value === "string";
}

function isParsableDate(value: unknown): boolean {
  return typeof value === "string" && value.trim() !== "" && !Number.isNaN(Date.parse(value));
}

const ACCOUNT_SNAPSHOT_NUMERIC_FIELDS = [
  "net_liquidation_value",
  "start_of_day_net_liquidation_value",
  "cash",
  "buying_power",
  "realized_pnl_day",
  "unrealized_pnl",
  "unrealized_pnl_total",
  "unrealized_pnl_day",
] as const;

const EXPOSURE_NUMERIC_FIELDS = [
  "gross_exposure",
  "gross_exposure_pct_nlv",
  "long_exposure",
  "short_exposure",
  "net_exposure",
] as const;

const EXECUTION_NUMERIC_FIELDS = ["price", "stop_price", "commission", "fx_rate_to_base"] as const;
const EXECUTION_STRING_FIELDS = [
  "trade_id",
  "asset_class",
  "stop_source",
  "stop_reference_date",
  "commission_currency",
  "open_close",
  "order_id",
] as const;

const POSITION_NUMERIC_FIELDS = [
  "average_price",
  "market_price",
  "market_value",
  "market_value_base",
  "unrealized_pnl",
  "unrealized_pnl_base",
  "unrealized_pnl_day",
  "unrealized_pnl_day_base",
  "fx_rate_to_base",
  "stop_price",
  "stop_lots",
] as const;
const POSITION_STRING_FIELDS = [
  "contract_id",
  "asset_class",
  "position_side",
  "currency",
  "stop_source",
  "stop_reference_date",
] as const;

function validateAccountSnapshot(raw: unknown, errors: string[]): void {
  if (!isPlainObject(raw)) {
    errors.push("account_snapshot muss ein Objekt sein.");
    return;
  }
  const snapshot = raw as IbkrJsonAccountSnapshot;

  for (const field of ACCOUNT_SNAPSHOT_NUMERIC_FIELDS) {
    if (!isNumberOrNullish((snapshot as Record<string, unknown>)[field])) {
      errors.push(`account_snapshot.${field} muss eine Zahl oder null sein.`);
    }
  }

  if (snapshot.exposure !== undefined && snapshot.exposure !== null) {
    if (!isPlainObject(snapshot.exposure)) {
      errors.push("account_snapshot.exposure muss ein Objekt sein.");
    } else {
      for (const field of EXPOSURE_NUMERIC_FIELDS) {
        if (!isNumberOrNullish((snapshot.exposure as Record<string, unknown>)[field])) {
          errors.push(`account_snapshot.exposure.${field} muss eine Zahl oder null sein.`);
        }
      }
    }
  }
}

function validateExecution(raw: unknown, index: number, errors: string[]): void {
  const label = `Execution ${index + 1}`;
  if (!isPlainObject(raw)) {
    errors.push(`${label}: muss ein Objekt sein.`);
    return;
  }
  const execution = raw as Record<string, unknown>;

  if (typeof execution.exec_id !== "string" || !execution.exec_id.trim()) {
    errors.push(`${label}: exec_id ist erforderlich und muss ein String sein.`);
  }
  if (typeof execution.symbol !== "string" || !execution.symbol.trim()) {
    errors.push(`${label}: symbol ist erforderlich und muss ein String sein.`);
  }
  if (typeof execution.side !== "string" || !["BUY", "SELL"].includes(execution.side.toUpperCase())) {
    errors.push(`${label}: side ist erforderlich und muss "BUY" oder "SELL" sein.`);
  }
  if (typeof execution.quantity !== "number") {
    errors.push(`${label}: quantity ist erforderlich und muss eine Zahl sein.`);
  }
  if (!isParsableDate(execution.trade_datetime)) {
    errors.push(`${label}: trade_datetime ist erforderlich und muss ein gültiges Datum sein.`);
  }

  for (const field of EXECUTION_NUMERIC_FIELDS) {
    if (!isNumberOrNullish(execution[field])) {
      errors.push(`${label}: ${field} muss eine Zahl sein.`);
    }
  }
  for (const field of EXECUTION_STRING_FIELDS) {
    if (!isStringOrNullish(execution[field])) {
      errors.push(`${label}: ${field} muss ein String sein.`);
    }
  }
}

function validatePosition(raw: unknown, index: number, errors: string[]): void {
  const label = `Position ${index + 1}`;
  if (!isPlainObject(raw)) {
    errors.push(`${label}: muss ein Objekt sein.`);
    return;
  }
  const position = raw as Record<string, unknown>;

  if (typeof position.symbol !== "string" || !position.symbol.trim()) {
    errors.push(`${label}: symbol ist erforderlich und muss ein String sein.`);
  }
  if (typeof position.quantity !== "number") {
    errors.push(`${label}: quantity ist erforderlich und muss eine Zahl sein.`);
  }

  for (const field of POSITION_NUMERIC_FIELDS) {
    if (!isNumberOrNullish(position[field])) {
      errors.push(`${label}: ${field} muss eine Zahl sein.`);
    }
  }
  for (const field of POSITION_STRING_FIELDS) {
    if (!isStringOrNullish(position[field])) {
      errors.push(`${label}: ${field} muss ein String sein.`);
    }
  }
}

/**
 * Parses and validates a manual IBKR JSON import. `expectedReviewDate`
 * is the date selected on the import page — the JSON's own review_date
 * must match it exactly, or the import is blocked (§4): a mismatch here
 * usually means the wrong file was picked, and silently trusting
 * whichever date is in the JSON risks filing a day's data under the
 * wrong trade_date.
 */
export function validateIbkrJsonImport(rawText: string, expectedReviewDate: string): IbkrJsonValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (e) {
    return { success: false, errors: [`Invalid JSON: ${e instanceof Error ? e.message : "Parsing fehlgeschlagen."}`] };
  }

  if (!isPlainObject(parsed)) {
    return { success: false, errors: ["Das JSON muss ein Objekt auf oberster Ebene sein."] };
  }

  const errors: string[] = [];
  const root = parsed as Record<string, unknown>;

  if (typeof root.schema_version !== "string" || !root.schema_version.trim()) {
    errors.push("schema_version fehlt.");
  }
  if (typeof root.review_date !== "string" || !root.review_date.trim()) {
    errors.push("review_date fehlt.");
  } else if (root.review_date !== expectedReviewDate) {
    errors.push("Das ausgewählte Datum stimmt nicht mit review_date im JSON überein.");
  }
  if (typeof root.base_currency !== "string" || !root.base_currency.trim()) {
    errors.push("base_currency fehlt.");
  }
  if (root.snapshot_datetime !== undefined && !isParsableDate(root.snapshot_datetime)) {
    errors.push("snapshot_datetime muss, falls vorhanden, ein gültiges Datum sein.");
  }
  if (root.account_snapshot === undefined) {
    errors.push("account_snapshot fehlt.");
  } else {
    validateAccountSnapshot(root.account_snapshot, errors);
  }
  if (!Array.isArray(root.positions)) {
    errors.push("positions muss ein Array sein.");
  } else {
    root.positions.forEach((p, i) => validatePosition(p, i, errors));
  }
  if (!Array.isArray(root.executions)) {
    errors.push("executions muss ein Array sein.");
  } else {
    root.executions.forEach((e, i) => validateExecution(e, i, errors));
  }

  // Duplicate exec_id WITHIN the same file — a distinct problem from
  // cross-import deduplication (handled at insert time via dedup_key),
  // this catches a malformed export up front instead of silently
  // dropping the second occurrence later.
  if (Array.isArray(root.executions)) {
    const seen = new Set<string>();
    root.executions.forEach((e, i) => {
      if (isPlainObject(e) && typeof e.exec_id === "string" && e.exec_id.trim()) {
        if (seen.has(e.exec_id)) {
          errors.push(`Execution ${i + 1}: exec_id "${e.exec_id}" ist im JSON mehrfach vorhanden.`);
        }
        seen.add(e.exec_id);
      }
    });
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: root as unknown as IbkrJsonImport };
}
