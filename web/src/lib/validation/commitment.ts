import type { WatchlistType } from "@/lib/supabase/types";

// Parses and validates the seven-section Pre-Market Commitment form.
// See LEGACY_JOURNAL_OS_V7_4_3_REFERENCE.md §2 for the canonical field
// list this is derived from.

export const ALLOWED_RISK_PCTS = [1, 0.5, 0.25] as const;
export const WATCHLIST_TYPES: WatchlistType[] = ["Prime", "Watchlist", "Secondary"];

// QQQ +8 ATR extension activates a 0.5% risk cap (§2 QQQ-EXTENSION).
const QQQ_EXTENSION_CAP_ATR_MULTIPLE = 8;
// MTD <= -7.5% is the current pause threshold (§2 MTD %).
const MTD_PAUSE_THRESHOLD_PCT = -7.5;
// >= 6 losers → reduced-size mode; >= 10 losers → mandatory review warning
// (§2 VERLUSTZÄHLER).
const REDUCED_SIZE_LOSER_COUNT = 6;
const REVIEW_TRIGGER_LOSER_COUNT = 10;

export type WatchlistItemFormValues = {
  ticker: string;
  riskPct: string;
  listType: string;
  notes: string;
};

export type EpCandidateFormValues = {
  ticker: string;
  gap8Pct: boolean;
  rvol15: boolean;
  newsTrigger: boolean;
  eventDay: boolean;
  contextNotDefensive: boolean;
  notes: string;
};

export type CommitmentFormValues = {
  // 1 · STATE + R%
  marketStateNote: string;
  systemRiskPct: string;
  committedRiskPct: string;

  // 2 · INDEX-LAGE (QQQ/SPY) — SPY field pending a DB migration, see
  // commitment-form.tsx.
  qqqAtrMultiple: string;
  qqqNote: string;

  // 3 · MTD %
  mtdManualPct: string;
  mtdAutoFreshEntryRealizedPct: string;
  mtdNote: string;

  // 4 · VERLUSTZÄHLER
  lossManualCounter: string;
  lossAutoCounter: string;
  lossNote: string;

  // 5 · WATCHLIST
  watchlist: WatchlistItemFormValues[];

  // 6 · EP-KANDIDATEN
  epCandidates: EpCandidateFormValues[];

  // 7 · OPERATIVER PLAN
  operationalPlan: string;
  improvementFocus: string;
};

export type CommitmentDraftInput = {
  market_state_note: string | null;
  system_risk_pct: number | null;
  committed_risk_pct: number | null;
  intraday_risk_pct: number | null;

  qqq_extension_atr_multiple: number | null;
  qqq_extension_cap_active: boolean;
  qqq_extension_note: string | null;

  mtd_manual_pct: number | null;
  mtd_auto_fresh_entry_realized_pct: number | null;
  mtd_pause_threshold_reached: boolean;
  mtd_note: string | null;

  loss_state_manual_counter: number | null;
  loss_state_auto_counter: number | null;
  loss_state_review_trigger_reached: boolean;
  loss_state_reduced_size_mode: boolean;
  loss_state_note: string | null;

  operational_plan: string | null;
  improvement_focus: string | null;

  watchlist: {
    ticker: string;
    risk_pct: number | null;
    list_type: WatchlistType;
    notes: string | null;
    sort_order: number;
  }[];

  ep_candidates: {
    ticker: string;
    gap_8_pct: boolean;
    rvol_1_5: boolean;
    news_trigger: boolean;
    event_day: boolean;
    context_not_defensive: boolean;
    notes: string | null;
  }[];
};

export type CommitmentFormState = {
  fieldErrors: Partial<Record<string, string>>;
  formError?: string;
  success?: boolean;
};

export const emptyCommitmentFormState: CommitmentFormState = { fieldErrors: {} };

type CommitmentValidationResult =
  | { success: true; data: CommitmentDraftInput }
  | { success: false; fieldErrors: CommitmentFormState["fieldErrors"]; formError?: string };

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseJsonArray<T>(formData: FormData, key: string): T[] {
  const raw = formData.get(key);
  if (typeof raw !== "string" || raw.trim() === "") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function parseAllowedRiskPct(
  raw: string,
  label: string,
  field: string,
  errors: CommitmentFormState["fieldErrors"],
  required: boolean
): number | null {
  if (raw === "") {
    if (required) errors[field] = `${label} ist erforderlich.`;
    return null;
  }
  const value = Number(raw);
  if (!ALLOWED_RISK_PCTS.includes(value as (typeof ALLOWED_RISK_PCTS)[number])) {
    errors[field] = `${label} muss 1.0, 0.5 oder 0.25 sein.`;
    return null;
  }
  return value;
}

function parseOptionalNumber(
  raw: string,
  label: string,
  field: string,
  errors: CommitmentFormState["fieldErrors"]
): number | null {
  if (raw === "") return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    errors[field] = `${label} muss eine Zahl sein.`;
    return null;
  }
  return value;
}

/**
 * Parses the draft form for saving (DRAFT → new revision). Validation here
 * is intentionally lenient — a draft may be incomplete. Lock-time
 * completeness ("seven required sections") is enforced separately by
 * `checkCommitmentCompleteForLock`, run just before locking.
 */
export function parseCommitmentForm(formData: FormData): CommitmentValidationResult {
  const fieldErrors: CommitmentFormState["fieldErrors"] = {};

  const marketStateNote = readString(formData, "marketStateNote");
  const systemRiskPct = parseAllowedRiskPct(
    readString(formData, "systemRiskPct"),
    "System-Risiko",
    "systemRiskPct",
    fieldErrors,
    false
  );
  const committedRiskPct = parseAllowedRiskPct(
    readString(formData, "committedRiskPct"),
    "Committed-Risiko",
    "committedRiskPct",
    fieldErrors,
    false
  );

  if (
    systemRiskPct !== null &&
    committedRiskPct !== null &&
    committedRiskPct > systemRiskPct
  ) {
    fieldErrors.committedRiskPct = "Committed-Risiko darf den System-Risiko-Cap nicht überschreiten.";
  }

  const qqqAtrMultiple = parseOptionalNumber(
    readString(formData, "qqqAtrMultiple"),
    "QQQ-ATR-Multiple",
    "qqqAtrMultiple",
    fieldErrors
  );
  const qqqNote = readString(formData, "qqqNote");
  // Auto-derived, not a separate manual checkbox — see module comment on
  // QQQ_EXTENSION_CAP_ATR_MULTIPLE for why.
  const qqqExtensionCapActive =
    qqqAtrMultiple !== null && qqqAtrMultiple >= QQQ_EXTENSION_CAP_ATR_MULTIPLE;

  const mtdManualPct = parseOptionalNumber(
    readString(formData, "mtdManualPct"),
    "MTD %",
    "mtdManualPct",
    fieldErrors
  );
  const mtdAutoFreshEntryRealizedPct = parseOptionalNumber(
    readString(formData, "mtdAutoFreshEntryRealizedPct"),
    "MTD Auto Fresh-Entry %",
    "mtdAutoFreshEntryRealizedPct",
    fieldErrors
  );
  const mtdNote = readString(formData, "mtdNote");
  // Auto-derived from the manual MTD figure (no live MTD feed in V1) —
  // see MTD_PAUSE_THRESHOLD_PCT.
  const mtdPauseThresholdReached =
    mtdManualPct !== null && mtdManualPct <= MTD_PAUSE_THRESHOLD_PCT;

  const lossManualCounter = parseOptionalNumber(
    readString(formData, "lossManualCounter"),
    "Verlustzähler (manuell)",
    "lossManualCounter",
    fieldErrors
  );
  const lossAutoCounter = parseOptionalNumber(
    readString(formData, "lossAutoCounter"),
    "Verlustzähler (auto)",
    "lossAutoCounter",
    fieldErrors
  );
  const lossNote = readString(formData, "lossNote");
  const effectiveLossCounter = lossManualCounter ?? lossAutoCounter;
  const lossReducedSizeMode =
    effectiveLossCounter !== null && effectiveLossCounter >= REDUCED_SIZE_LOSER_COUNT;
  const lossReviewTriggerReached =
    effectiveLossCounter !== null && effectiveLossCounter >= REVIEW_TRIGGER_LOSER_COUNT;

  const operationalPlan = readString(formData, "operationalPlan");
  const improvementFocus = readString(formData, "improvementFocus");

  const rawWatchlist = parseJsonArray<WatchlistItemFormValues>(formData, "watchlistJson");
  const seenTickers = new Set<string>();
  const watchlist: CommitmentDraftInput["watchlist"] = [];

  rawWatchlist.forEach((item, index) => {
    const ticker = (item.ticker ?? "").trim().toUpperCase();
    if (!ticker) return;
    // "The original order is preserved and duplicates are removed."
    if (seenTickers.has(ticker)) return;
    seenTickers.add(ticker);

    if (!WATCHLIST_TYPES.includes(item.listType as WatchlistType)) {
      fieldErrors.watchlist = `Watchlist-Zeile ${index + 1}: ungültiger List-Type.`;
      return;
    }

    const riskPctRaw = (item.riskPct ?? "").toString().trim();
    let riskPct: number | null = null;
    if (riskPctRaw !== "") {
      const parsed = Number(riskPctRaw);
      if (!Number.isFinite(parsed)) {
        fieldErrors.watchlist = `Watchlist-Zeile ${index + 1}: Risk % muss eine Zahl sein.`;
        return;
      }
      riskPct = parsed;
    }

    watchlist.push({
      ticker,
      risk_pct: riskPct,
      list_type: item.listType as WatchlistType,
      notes: (item.notes ?? "").trim() || null,
      sort_order: watchlist.length,
    });
  });

  const rawEpCandidates = parseJsonArray<EpCandidateFormValues>(formData, "epCandidatesJson");
  const watchlistTickers = new Set(watchlist.map((w) => w.ticker));
  const epCandidates: CommitmentDraftInput["ep_candidates"] = [];

  rawEpCandidates.forEach((candidate, index) => {
    const ticker = (candidate.ticker ?? "").trim().toUpperCase();
    if (!ticker) return;

    // "An EP candidate must also be on the committed watchlist."
    if (!watchlistTickers.has(ticker)) {
      fieldErrors.epCandidates = `EP-Kandidat ${index + 1} (${ticker}): muss auch auf der Watchlist stehen.`;
      return;
    }

    epCandidates.push({
      ticker,
      gap_8_pct: Boolean(candidate.gap8Pct),
      rvol_1_5: Boolean(candidate.rvol15),
      news_trigger: Boolean(candidate.newsTrigger),
      event_day: Boolean(candidate.eventDay),
      context_not_defensive: Boolean(candidate.contextNotDefensive),
      notes: (candidate.notes ?? "").trim() || null,
    });
  });

  if (Object.keys(fieldErrors).length > 0) {
    return { success: false, fieldErrors };
  }

  return {
    success: true,
    data: {
      market_state_note: marketStateNote || null,
      system_risk_pct: systemRiskPct,
      committed_risk_pct: committedRiskPct,
      // Intraday risk starts equal to committed risk at save time; it can
      // only move downward from here, via commitment_risk_changes, once
      // locked.
      intraday_risk_pct: committedRiskPct,

      qqq_extension_atr_multiple: qqqAtrMultiple,
      qqq_extension_cap_active: qqqExtensionCapActive,
      qqq_extension_note: qqqNote || null,

      mtd_manual_pct: mtdManualPct,
      mtd_auto_fresh_entry_realized_pct: mtdAutoFreshEntryRealizedPct,
      mtd_pause_threshold_reached: mtdPauseThresholdReached,
      mtd_note: mtdNote || null,

      loss_state_manual_counter: lossManualCounter,
      loss_state_auto_counter: lossAutoCounter,
      loss_state_review_trigger_reached: lossReviewTriggerReached,
      loss_state_reduced_size_mode: lossReducedSizeMode,
      loss_state_note: lossNote || null,

      operational_plan: operationalPlan || null,
      improvement_focus: improvementFocus || null,

      watchlist,
      ep_candidates: epCandidates,
    },
  };
}

/**
 * Lock-time completeness check for the "seven required sections".
 * Interpretation (not fully unambiguous from the legacy reference —
 * documented here per project convention): each section must contain at
 * least its primary input before locking; EP candidates remain optional
 * since not every day has one.
 */
export function checkCommitmentCompleteForLock(
  data: CommitmentDraftInput
): string[] {
  const missing: string[] = [];

  if (!data.market_state_note) missing.push("1 · State + R%: Marktlage/persönlicher Zustand fehlt.");
  if (data.committed_risk_pct === null) missing.push("1 · State + R%: Committed-Risiko fehlt.");
  if (data.qqq_extension_atr_multiple === null && !data.qqq_extension_note) {
    missing.push("2 · Index-Lage: ATR-Multiple oder eine Notiz fehlt.");
  }
  if (data.mtd_manual_pct === null) missing.push("3 · MTD %: Wert fehlt.");
  if (data.loss_state_manual_counter === null) missing.push("4 · Verlustzähler: Wert fehlt.");
  if (data.watchlist.length === 0) missing.push("5 · Watchlist: mindestens ein Ticker erforderlich.");
  if (!data.operational_plan) missing.push("7 · Operativer Plan: Text fehlt.");

  return missing;
}
