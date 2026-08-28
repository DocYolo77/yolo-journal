import type {
  DailyReviewType,
  GuardrailEntry,
  GuardrailStatus,
  ManualPortfolioPosition,
  MentalStatus,
  TickerReview,
} from "@/lib/supabase/types";

// Parses and validates the Daily Review form. Field vocabulary is taken
// verbatim from LEGACY_JOURNAL_OS_V7_4_3_REFERENCE.md §11/§14-16 —
// nothing here is invented.

export const REVIEW_TYPES: DailyReviewType[] = ["ENTRY", "MANAGEMENT"];

// Replaced 2026-08 for a cleaner, non-overlapping Setup/Structure split
// — the old ["Breakout","Pullback","Episodic Pivot"] vocabulary blurred
// into Structure's own categories. Historical ticker reviews keep
// whatever value they were saved with (free text under the hood); only
// the selectable options change going forward.
// Re-cased 2026-08 to normal, readable text (was the raw
// EP/WEDGE_POP/MOMENTUM_PULLBACK/REBASE codes) once Structure was
// dropped from the editor and Setup became the only classification
// field left.
export const SETUP_OPTIONS = ["Rebase", "Episodic Pivot", "Momentum Pullback", "Wedge Pop"];

// "Trigger" renamed to "Entry-Taktik" per user correction — the ORB
// entries (M30/M15/M5) are the ones that gate which Stop Placement
// options are selectable, see ORB_ENTRY_TACTICS below.
export const ENTRY_TACTIC_OPTIONS = ["M30 ORB", "M15 ORB", "M5 ORB", "PDH BO", "PDL Pullback", "EMA Pullback"];

export const ORB_ENTRY_TACTICS = ["M30 ORB", "M15 ORB", "M5 ORB"];

export const STOP_PLACEMENT_OPTIONS = [
  "2-Stops ORL",
  "1-Stop ORL",
  "2-Stops Session Low",
  "1-Stop Session Low",
  "%-Stop",
  "Sonstiges",
];

// Only selectable when Entry-Taktik is one of ORB_ENTRY_TACTICS — an ORL
// (opening-range low) stop only makes sense relative to an ORB entry.
export const ORL_RESTRICTED_STOP_OPTIONS = ["2-Stops ORL", "1-Stop ORL"];

export const EXIT_SETUP_OPTIONS = ["Close < EMA10", "Sonstiges"];

export const EXIT_TACTIC_OPTIONS = ["M5 ORL", "Random", "Sonstiges"];

export const STRUCTURE_OPTIONS = ["Wedge Pop", "Momentum Pullback", "HTF Pullback", "Flat Base", "Episodic Pivot"];

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
  { id: "social_media_influence", label: "Social Media Einfluss an dem Tag?" },
];

export type DailyReviewInput = {
  review_type: DailyReviewType | null;
  status: "DRAFT" | "COMPLETED";
  net_liquidation_value: number | null;
  daily_pnl: number | null;
  market_thought: string | null;
  market_environment: string | null;
  portfolio_comment: string | null;
  manual_portfolio_positions: ManualPortfolioPosition[];
  guardrails: GuardrailEntry[];
  guardrails_reviewed: boolean;
  mental: MentalStatus;
  positive: string | null;
  weakness: string | null;
  coaching_take: string | null;
  self_grade: string | null;
  grade_reason: string | null;
  operational_todos: string[];
  shadowlist_comment: string | null;
  ticker_reviews: TickerReview[];
};

/** Normalizes a manual portfolio position row loaded from the client's JSON hidden input. */
export function normalizeManualPortfolioPosition(
  row: Partial<ManualPortfolioPosition> & Record<string, unknown>
): ManualPortfolioPosition {
  const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return {
    symbol: (row.symbol ?? "").toString().trim().toUpperCase(),
    quantity: typeof row.quantity === "number" && Number.isFinite(row.quantity) ? row.quantity : 0,
    average_price: num(row.average_price),
    market_price: num(row.market_price),
    unrealized_pnl: num(row.unrealized_pnl),
    currency: row.currency ? row.currency.toString().trim().toUpperCase() : null,
  };
}

/**
 * Normalizes a ticker review row loaded from storage or the client into
 * the current TickerReview shape. Falls back to the pre-correction
 * `trigger` key for `entry_tactic` so ticker reviews saved before this
 * pass keep their values instead of silently losing them.
 */
export function normalizeTickerReview(row: Partial<TickerReview> & Record<string, unknown>): TickerReview {
  const rawStopPct = row.stop_placement_pct;
  return {
    ticker: (row.ticker ?? "").toString().trim().toUpperCase(),
    setup: (row.setup ?? "").toString(),
    entry_tactic: (row.entry_tactic ?? row.trigger ?? "").toString(),
    stop_placement: (row.stop_placement ?? "").toString(),
    stop_placement_pct: typeof rawStopPct === "number" && Number.isFinite(rawStopPct) ? rawStopPct : null,
    structure: (row.structure ?? "").toString(),
    structure_rating: (row.structure_rating ?? "").toString(),
    thesis: (row.thesis ?? "").toString().trim(),
    qullamaggie_rating: (row.qullamaggie_rating ?? "").toString().trim(),
    management_grade: (row.management_grade ?? "").toString(),
    rule_status: (row.rule_status ?? "").toString(),
    notes: (row.notes ?? "").toString().trim(),
    exit_setup: (row.exit_setup ?? "").toString(),
    exit_tactic: (row.exit_tactic ?? "").toString(),
  };
}

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
  const portfolioComment = readString(formData, "portfolioComment");

  const rawManualPortfolio = parseJson<(Partial<ManualPortfolioPosition> & Record<string, unknown>)[]>(
    formData,
    "manualPortfolioPositionsJson",
    []
  );
  const manualPortfolioPositions = rawManualPortfolio
    .map((row) => normalizeManualPortfolioPosition(row))
    .filter((row) => row.symbol);

  const rawGuardrails = parseJson<GuardrailEntry[]>(formData, "guardrailsJson", []);
  const guardrailsById = new Map(rawGuardrails.map((g) => [g.guardrail_id, g]));
  const guardrails: GuardrailEntry[] = CANONICAL_GUARDRAILS.map((canonical) => {
    const existing = guardrailsById.get(canonical.id);
    return {
      guardrail_id: canonical.id,
      guardrail: canonical.label,
      // Guardrails default to "Eingehalten" — the explicit
      // "Guardrails geprüft?" checkbox (guardrails_reviewed), not a
      // blank status, is the real confirmation signal.
      status: (existing?.status as GuardrailEntry["status"]) || "Eingehalten",
      comment: (existing?.comment ?? "").toString().trim(),
    };
  });

  const guardrailsReviewed = readString(formData, "guardrailsReviewed") === "true";

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
    influence_note: (rawMental.influence_note ?? "").toString().trim(),
  };

  const positive = readString(formData, "positive");
  const weakness = readString(formData, "weakness");
  const coachingTake = readString(formData, "coachingTake");
  const selfGrade = readString(formData, "selfGrade");
  const gradeReason = readString(formData, "gradeReason");
  const shadowlistComment = readString(formData, "shadowlistComment");

  const rawTodos = parseJson<string[]>(formData, "operationalTodosJson", []);
  const operationalTodos = rawTodos.map((t) => t.trim()).filter(Boolean);

  const rawTickerReviews = parseJson<(Partial<TickerReview> & Record<string, unknown>)[]>(
    formData,
    "tickerReviewsJson",
    []
  );
  const tickerReviews: TickerReview[] = [];
  const seenTickers = new Set<string>();

  rawTickerReviews.forEach((row, index) => {
    const normalized = normalizeTickerReview(row);
    if (!normalized.ticker) return;
    if (seenTickers.has(normalized.ticker)) {
      fieldErrors.tickerReviews = `Ticker-Review ${index + 1}: ${normalized.ticker} ist doppelt.`;
      return;
    }
    seenTickers.add(normalized.ticker);
    tickerReviews.push(normalized);
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
      portfolio_comment: portfolioComment || null,
      manual_portfolio_positions: manualPortfolioPositions,
      guardrails,
      guardrails_reviewed: guardrailsReviewed,
      mental,
      positive: positive || null,
      weakness: weakness || null,
      coaching_take: coachingTake || null,
      self_grade: selfGrade || null,
      grade_reason: gradeReason || null,
      operational_todos: operationalTodos,
      shadowlist_comment: shadowlistComment || null,
      ticker_reviews: tickerReviews,
    },
  };
}
