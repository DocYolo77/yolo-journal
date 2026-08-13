import type { ExecutionSide } from "@/lib/supabase/types";

export const EXECUTION_SIDES: ExecutionSide[] = ["buy", "sell"];

export type ExecutionFormValues = {
  side: string;
  executedAt: string;
  quantity: string;
  price: string;
  fees: string;
  notes: string;
};

export type ExecutionInsertInput = {
  side: ExecutionSide;
  execution_type: "fill";
  executed_at: string;
  quantity: number;
  price: number | null;
  fees: number;
  notes: string | null;
};

export type ExecutionFormState = {
  fieldErrors: Partial<Record<keyof ExecutionFormValues, string>>;
  formError?: string;
  success?: boolean;
};

export const emptyExecutionFormState: ExecutionFormState = { fieldErrors: {} };

type ExecutionValidationResult =
  | { success: true; data: ExecutionInsertInput }
  | { success: false; fieldErrors: ExecutionFormState["fieldErrors"]; formError?: string };

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function parseExecutionForm(formData: FormData): ExecutionValidationResult {
  const values: ExecutionFormValues = {
    side: readString(formData, "side"),
    executedAt: readString(formData, "executedAt"),
    quantity: readString(formData, "quantity"),
    price: readString(formData, "price"),
    fees: readString(formData, "fees"),
    notes: readString(formData, "notes"),
  };

  const fieldErrors: ExecutionFormState["fieldErrors"] = {};

  if (!EXECUTION_SIDES.includes(values.side as ExecutionSide)) {
    fieldErrors.side = "Bitte Buy oder Sell wählen.";
  }

  let executedAtIso: string | null = null;
  if (!values.executedAt) {
    fieldErrors.executedAt = "Zeitpunkt ist erforderlich.";
  } else {
    const date = new Date(values.executedAt);
    if (Number.isNaN(date.getTime())) {
      fieldErrors.executedAt = "Zeitpunkt ist kein gültiges Datum.";
    } else {
      executedAtIso = date.toISOString();
    }
  }

  let quantity: number | null = null;
  if (!values.quantity) {
    fieldErrors.quantity = "Menge ist erforderlich.";
  } else {
    quantity = Number(values.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      fieldErrors.quantity = "Menge muss eine Zahl größer als 0 sein.";
    }
  }

  let price: number | null = null;
  if (values.price !== "") {
    price = Number(values.price);
    if (!Number.isFinite(price)) {
      fieldErrors.price = "Preis muss eine Zahl sein.";
    }
  }

  let fees = 0;
  if (values.fees !== "") {
    fees = Number(values.fees);
    if (!Number.isFinite(fees)) {
      fieldErrors.fees = "Fees müssen eine Zahl sein.";
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { success: false, fieldErrors };
  }

  return {
    success: true,
    data: {
      side: values.side as ExecutionSide,
      execution_type: "fill",
      executed_at: executedAtIso as string,
      quantity: quantity as number,
      price,
      fees,
      notes: values.notes || null,
    },
  };
}
