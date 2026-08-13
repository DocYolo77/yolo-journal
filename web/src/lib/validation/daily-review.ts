import type {
  DailyReviewType,
  GuardrailEntry,
  GuardrailStatus,
  MentalStatus,
  TickerReview,
} from "@/lib/supabase/types";

// Parses and validates the Daily Review form. Field vocabulary is taken
// verbatim from LEGACY_JOURNAL_OS_V7_4_3_REFERENCE.md §11/§14-16 —
// nothing here is invented.

export const REVIEW_TYPES: DailyReviewType[] = ["ENTRY", "MANAGEMENT"];

export const SETUP_OPTIONS = [
  "Breakout",
  "Pullback",
  "Episodic Pivot",
  "Undercut & Reclaim",
  "M5 ORB",
  "M15 ORB",
  "M30 ORB",
  "Dip / MACD",
  "Push-out PDH",
  "FTD",
  "Sonstiges",
];

export const TRIGGER_OPTIONS = [
  "M5 ORH",
  "M15 ORH",
  "M30 ORH",
  "PDH Break",
  "PDL Undercut & Reclaim",
  "EMA10 Reclaim",
  "EMA20 Reclaim",
  "MACD Cross",
  "Diskretionär innerhalb Framework",
  "Sonstiges",
];

export const STRUCTURE_OPTIONS = [
  "Base",
  "Pullback",
  "Handle",
  "Double Bottom",
  "Flat Base",
  "VCP",
  "Episodic Pivot",
  "FTD",
  "Sonstiges",
];

export const STRUCTURE_RATING_OPTIONS = ["Vorläufig", "A+", "A", "B", "C", "Kein Setup"];

export const MANAGEMENT_GRADE_OPTIONS = ["Sehr gut", "Gut", "Ausreichend", "Schwach", "Fehlerhaft"];

export const RULE_STATUS_OPTIONS = [
  "Framework-konform",
  "Legitime Diskretion",
  "Organisatorischer Fehler",
  "Regelbruch",
  "Bewusster Override",
];

export const MENTAL_STATE_OPTIONS = [
  "Unauffällig",
  "Ruhig",
  "Fokussiert",
  "Müde",
  "Angespannt",
  "FOMO",
  "Frustriert",
  "Übermotiviert",
  "Unkonzentriert",
  "Sonstiges",
];

export const GUARDRAIL_STATUSES: GuardrailStatus[] = ["Eingehalten", "Verletzt", "Nicht anwendbar"];

export const CANONICAL_GUARDRAILS: { id: string; label: string }[] = [
  { id: "committed_names_only", label: "Nur committed Prime-Namen gehandelt" },
  { id: "max_entries", label: "Maximale Entryanzahl eingehalten" },
  { id: "risk_limit", label: "Vorgegebenes Risiko eingehalten" },
  { id: "loss_streak_reduction", label: "Losing-Streak-Risikoreduktion eingehalten" },
  { id: "three_unmodified_positions", label: "Keine neuen Entries bei drei unmodifizierten Positionen" },
  { id: "minimum_entry_time", label: "Mindest-Entryzeit eingehalten" },
  { id: "mtd_pause", label: "MTD-Pausenregel eingehalten" },
  { id: "no_impulsive_adds", label: "Keine impulsiven Adds" },
  { id: "committed_triggers_only", label: "Keine nicht committed Trigger gehandelt" },
];

export type DailyReviewInput = {
  review_type: DailyReviewType | null;
  status: "DRAFT" | "COMPLETED";
  net_liquidation_value: number | null;
  daily_pnl: number | null;
  market_thought: string | null;
  market_environment: string | null;
  guardrails: GuardrailEntry[];
  mental: MentalStatus;
  positive: string | null;
  weakness: string | null;
  coaching_take: string | null;
  self_grade: string | null;
  grade_reason: string | null;
  operational_todos: string[];
  ticker_reviews: TickerReview[];
};

export type DailyReviewFormState = {
  fieldErrors: Partial<Record<string, string>>;
  formError?: string;
  success?: boolean;
};

export const emptyDailyReviewFormState: DailyReviewFormState = { fieldErrors: {} };

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseJson<T>(formData: FormData, key: string, fallback: T): T {
  const raw = formData.get(key);
  if (typeof raw !== "string" || raw.trim() === "") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

type ValidationResult =
  | { success: true; data: DailyReviewInput }
  | { success: false; fieldErrors: DailyReviewFormState["fieldErrors"]; formError?: string };

/**
 * Parses the Daily Review form. Deliberately lenient — a review is a
 * free-form save/reload document for the Beta, not a locked/versioned
 * object like the Commitment, so there is no separate "complete for
 * lock" gate. `status` ('DRAFT' | 'COMPLETED') is a user-set label, not
 * an enforced completeness check.
 */
export function parseDailyReviewForm(formData: FormData): ValidationResult {
  const fieldErrors: DailyReviewFormState["fieldErrors"] = {};

  const reviewTypeRaw = readString(formData, "reviewType");
  const reviewType = REVIEW_TYPES.includes(reviewTypeRaw as DailyReviewType)
    ? (reviewTypeRaw as DailyReviewType)
    : null;

  const statusRaw = readString(formData, "status");
  const status = statusRaw === "COMPLETED" ? "COMPLETED" : "DRAFT";

  const nlvRaw = readString(formData, "netLiquidationValue");
  let netLiquidationValue: number | null = null;
  if (nlvRaw !== "") {
    const parsed = Number(nlvRaw);
    if (!Number.isFinite(parsed)) {
      fieldErrors.netLiquidationValue = "NLV muss eine Zahl sein.";
    } else {
      netLiquidationValue = parsed;
    }
  }

  const pnlRaw = readString(formData, "dailyPnl");
  let dailyPnl: number | null = null;
  if (pnlRaw !== "") {
    const parsed = Number(pnlRaw);
    if (!Number.isFinite(parsed)) {
      fieldErrors.dailyPnl = "Daily P&L muss eine Zahl sein.";
    } else {
      dailyPnl = parsed;
    }
  }

  const marketThought = readString(formData, "marketThought");
  const marketEnvironment = readString(formData, "marketEnvironment");

  const rawGuardrails = parseJson<GuardrailEntry[]>(formData, "guardrailsJson", []);
  const guardrailsById = new Map(rawGuardrails.map((g) => [g.guardrail_id, g]));
  const guardrails: GuardrailEntry[] = CANONICAL_GUARDRAILS.map((canonical) => {
    const existing = guardrailsById.get(canonical.id);
    return {
      guardrail_id: canonical.id,
      guardrail: canonical.label,
      status: (existing?.status as GuardrailEntry["status"]) ?? "",
      comment: (existing?.comment ?? "").toString().trim(),
    };
  });

  const rawMental = parseJson<Partial<MentalStatus>>(formData, "mentalJson", {});
  const focusRaw = rawMental.focus;
  let focus: number | null = null;
  if (focusRaw !== null && focusRaw !== undefined && String(focusRaw) !== "") {
    const parsed = Number(focusRaw);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 5) {
      fieldErrors.mentalFocus = "Focus muss zwischen 1 und 5 liegen.";
    } else {
      focus = parsed;
    }
  }
  const mental: MentalStatus = {
    states: Array.isArray(rawMental.states) ? rawMental.states.filter((s) => typeof s === "string") : [],
    other_state: (rawMental.other_state ?? "").toString().trim(),
    focus,
    influence: (rawMental.influence ?? "").toString().trim(),
    influence_note: (rawMental.influence_note ?? "").toString().trim(),
  };

  const positive = readString(formData, "positive");
  const weakness = readString(formData, "weakness");
  const coachingTake = readString(formData, "coachingTake");
  const selfGrade = readString(formData, "selfGrade");
  const gradeReason = readString(formData, "gradeReason");

  const rawTodos = parseJson<string[]>(formData, "operationalTodosJson", []);
  const operationalTodos = rawTodos.map((t) => t.trim()).filter(Boolean);

  const rawTickerReviews = parseJson<TickerReview[]>(formData, "tickerReviewsJson", []);
  const tickerReviews: TickerReview[] = [];
  const seenTickers = new Set<string>();

  rawTickerReviews.forEach((row, index) => {
    const ticker = (row.ticker ?? "").trim().toUpperCase();
    if (!ticker) return;
    if (seenTickers.has(ticker)) {
      fieldErrors.tickerReviews = `Ticker-Review ${index + 1}: ${ticker} ist doppelt.`;
      return;
    }
    seenTickers.add(ticker);

    tickerReviews.push({
      ticker,
      setup: (row.setup ?? "").toString(),
      trigger: (row.trigger ?? "").toString(),
      structure: (row.structure ?? "").toString(),
      structure_rating: (row.structure_rating ?? "").toString(),
      thesis: (row.thesis ?? "").toString().trim(),
      intended_stop_logic: (row.intended_stop_logic ?? "").toString().trim(),
      management_intent: (row.management_intent ?? "").toString().trim(),
      management_grade: (row.management_grade ?? "").toString(),
      rule_status: (row.rule_status ?? "").toString(),
      notes: (row.notes ?? "").toString().trim(),
    });
  });

  if (Object.keys(fieldErrors).length > 0) {
    return { success: false, fieldErrors };
  }

  return {
    success: true,
    data: {
      review_type: reviewType,
      status,
      net_liquidation_value: netLiquidationValue,
      daily_pnl: dailyPnl,
      market_thought: marketThought || null,
      market_environment: marketEnvironment || null,
      guardrails,
      mental,
      positive: positive || null,
      weakness: weakness || null,
      coaching_take: coachingTake || null,
      self_grade: selfGrade || null,
      grade_reason: gradeReason || null,
      operational_todos: operationalTodos,
      ticker_reviews: tickerReviews,
    },
  };
}
