import type { DailyReviewGuardrailStatus } from "@/lib/supabase/types";

// v2 Daily Review — a pure capture tool. This file holds only the
// vocabulary that has to be a stable, shared constant (the fixed
// guardrail keys, the shadow-text prompts) and small field normalizers.
// There are deliberately no Setup/Trigger/Stop-Logic option lists here
// — those are free text with autocomplete-from-history (see
// lib/data/daily-review.ts's getFieldSuggestions), not enums. "Die
// Setup-Sprache ändert sich schneller als jedes Enum."

// §3.4 — the only block with fixed structure. Nine keys, exact order,
// exact German labels. The Action-Fenster/Entry-Zeitfenster guardrail
// from the old system is deliberately not here (spec: "ist kein
// Guardrail und taucht in dieser Liste nicht auf").
export const DAILY_REVIEW_GUARDRAILS: { key: string; label: string }[] = [
  { key: "source", label: "Nur Namen von der Vorab-Watchlist" },
  { key: "daily_limit", label: "Tageslimit 3 Ticker" },
  { key: "risk", label: "Risk-Limit eingehalten" },
  { key: "securing", label: "Sicherungs-Schranke (nicht 3 offen und keine gesichert)" },
  { key: "freq_stop", label: "Intraday-Frequenz-Stop (2× ≤ −0,5R)" },
  { key: "mtd", label: "MTD-Pausenregel" },
  { key: "no_impulse_adds", label: "Keine impulsiven Adds" },
  { key: "own_trigger", label: "Entry auf dem eigenen Trigger — nicht davor" },
  { key: "stop_sacred", label: "Stop unverletzlich, kein Aussitzen" },
];

export const GUARDRAIL_STATUS_LABELS: Record<DailyReviewGuardrailStatus, string> = {
  held: "Eingehalten",
  broken: "Verletzt",
  override: "Bewusster Override",
  na: "n. a.",
};

export const GUARDRAIL_STATUS_ORDER: DailyReviewGuardrailStatus[] = ["held", "broken", "override", "na"];

// §4 — Shadowtexte. Placeholder-as-prompt text, styled as a guiding
// question, never persisted. Verbatim German wording from the spec —
// do not paraphrase, the exact phrasing is what makes them work as a
// recall cue.
export const SHADOW_TEXTS = {
  marketContext:
    "Wo stehen QQQ/SPY zu EMA10, EMA20, SMA50? Wie weit sind die Indizes vom SMA50 entfernt — ist etwas überdehnt? Was hat die Breite gemacht, wer führt, wer bricht? Auflösung oder weiter in der Range?",
  personalState:
    "Wie war der Zustand vor dem Open — und hat er sich während der Session verändert? Fester Screen oder unterwegs? Gab es einen Impuls, den du erkannt und nicht ausgeführt hast? Euphorie? Angst? Verzweiflung? Teilst du Screenshots?",
  gameplan:
    "Was war der Plan vor dem Open — und wo stand er geschrieben? Wolltest du Stärke oder Rücksetzer kaufen? Wo wolltest du aggressiv sein und warum genau dort?",
  tradeSetup:
    "Welche Struktur, in deinen Worten? Steht der Name über oder unter EMA10/EMA20? Tight and orderly — oder Barcode? Wie eng waren die letzten zwei bis drei Sessions?",
  tradeTriggerTactic:
    "Welcher Trigger, und hast du ihn abgewartet — oder warst du vorher drin? War das der optimale Einstieg der letzten 5–10 Tage? Falls nein: Wo lag der bessere Punkt, und warum hast du ihn nicht genommen?",
  tradeStopLogic: "Wo lag der Anker und wie weit war er entfernt? War der Stop erreichbar oder konstruiert?",
  tradeWhatHappened:
    "Verlauf ohne Bewertung. Traktion sofort, Rücksetzer, Stop, Re-Add? Wie sah die Schlusskerze aus?",
  tradeManagement:
    "Stop nachgezogen, Partial, Add, Teil-Exit? Wenn nichts passiert ist: warum nicht — bewusst gehalten oder nicht hingesehen? Bei Partials und späten Adds: Was war der Grund, nicht nur der Preis?",
  tradeStopNow: "Nur bei Änderung ausfüllen. Wo liegt der Stop nach Handelsschluss? Leer heißt unverändert.",
  tradeMyThinking:
    "Warum dieser Trade, warum diese Größe, warum hältst du ihn — oder warum nicht? Was hättest du getan, wenn es sofort gegen dich gelaufen wäre?",
  whatWentWell: "Nicht nur Ergebnisse — auch Dinge, die du gelassen hast. Welche Regel hat gehalten, obwohl sie unbequem war?",
  whatWentWrong: "Wo bist du vom Plan abgewichen, und war die Abweichung bewusst? Welcher Fehler ist eine Wiederholung?",
  whatToImprove: "Eine Sache. Konkret genug, dass sie morgen prüfbar ist.",
  guardrailsNote:
    "Limit, Risiko, Quelle, Stops — was hat gehalten, was nicht? Bewusster Override zählt als eingehalten, wenn er als solcher deklariert ist.",
  selfGrade: "Deutsche Schulnote, Prozess nicht PnL. Ein grüner Tag kann eine 4 sein, ein roter eine 1.",
  watchlistNext: "Welche Namen sind reif — und in welche Richtung? Was steht schon in Position und braucht morgen eine Entscheidung?",
  nextSessionPlan:
    "Stärke oder Rücksetzer? Wo willst du aggressiv sein, wo gar nicht? Welche Taktik pro Name, und was muss passieren, damit du NICHT klickst? Was ist heute liegengeblieben, das morgen zuerst drankommt?",
  opportunitySpike:
    "Welche Gruppe, welches Setup, welche frische Traktion würden morgen mehr Risk rechtfertigen? Eine Zeile genügt. Wenn nichts davon eintritt: Standard-Risk. Bedingung vorher aufschreiben, nicht hinterher begründen.",
} as const;

/** Uppercase-trims a ticker input. Empty string means "not a valid ticker". */
export function normalizeTicker(raw: string): string {
  return raw.trim().toUpperCase();
}

/** Parses a free-text numeric field (risk %, 1R USD, NLV, focus level) — empty string means "leave null", not zero. */
export function parseOptionalNumber(raw: string): { value: number | null; error?: string } {
  const trimmed = raw.trim();
  if (trimmed === "") return { value: null };
  const parsed = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(parsed)) return { value: null, error: "Muss eine Zahl sein." };
  return { value: parsed };
}

/** Focus level: 1..5, half-steps allowed (3.5 is a real recorded value), no default. */
export function parseFocusLevel(raw: string): { value: number | null; error?: string } {
  const result = parseOptionalNumber(raw);
  if (result.error || result.value === null) return result;
  if (result.value < 1 || result.value > 5) {
    return { value: null, error: "Fokus muss zwischen 1 und 5 liegen." };
  }
  return result;
}

/** Trims a free-text field to null-if-empty, so autosave never persists a lone empty string. */
export function normalizeText(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}
