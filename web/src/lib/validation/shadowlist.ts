// See LEGACY_JOURNAL_OS_V7_4_3_REFERENCE.md §6.1.

export const DECISIONS = ["Genommen", "Nicht genommen"] as const;
export type Decision = (typeof DECISIONS)[number];

export const REASONS = [
  "Kein Trigger",
  "Entry-Filter nicht erfüllt",
  "Entry-Limit erreicht",
  "Risk-/Regimefilter",
  "Bewusst ausgelassen",
  "Übersehen",
  "Bereits in Position",
  "Sonstiges",
] as const;
export type Reason = (typeof REASONS)[number];

export type ShadowlistDecisionFormValues = {
  id: string;
  decision: string;
  reason: string;
  notes: string;
};

export type ShadowlistDecisionUpdate = {
  id: string;
  decision: Decision;
  reason: Reason | null;
  notes: string | null;
};

export type ShadowlistFormState = {
  fieldErrors: Partial<Record<string, string>>;
  formError?: string;
  success?: boolean;
};

export const emptyShadowlistFormState: ShadowlistFormState = { fieldErrors: {} };

type ShadowlistValidationResult =
  | { success: true; data: ShadowlistDecisionUpdate[] }
  | { success: false; fieldErrors: ShadowlistFormState["fieldErrors"]; formError?: string };

export function parseShadowlistForm(formData: FormData): ShadowlistValidationResult {
  const raw = formData.get("decisionsJson");
  const fieldErrors: ShadowlistFormState["fieldErrors"] = {};

  if (typeof raw !== "string" || raw.trim() === "") {
    return { success: false, fieldErrors: {}, formError: "Keine Entscheidungen übermittelt." };
  }

  let parsed: ShadowlistDecisionFormValues[];
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { success: false, fieldErrors: {}, formError: "Entscheidungen konnten nicht gelesen werden." };
  }

  if (!Array.isArray(parsed)) {
    return { success: false, fieldErrors: {}, formError: "Entscheidungen konnten nicht gelesen werden." };
  }

  const data: ShadowlistDecisionUpdate[] = [];

  for (const item of parsed) {
    if (!item.id) continue;

    if (!DECISIONS.includes(item.decision as Decision)) {
      fieldErrors[item.id] = "Ungültige Entscheidung.";
      continue;
    }

    const decision = item.decision as Decision;
    let reason: Reason | null = null;

    if (decision === "Nicht genommen") {
      if (!REASONS.includes(item.reason as Reason)) {
        fieldErrors[item.id] = "Bitte einen Grund auswählen.";
        continue;
      }
      reason = item.reason as Reason;
    }

    data.push({
      id: item.id,
      decision,
      reason,
      notes: (item.notes ?? "").trim() || null,
    });
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { success: false, fieldErrors };
  }

  return { success: true, data };
}
