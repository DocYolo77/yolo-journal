import type {
  WeeklyRegime,
  WeeklyReviewProzessVsErgebnis,
  WeeklyReviewTradeGrade,
  WeeklyReviewTradeSeite,
  WeeklySelfGrade,
} from "@/lib/supabase/types";

// Weekly Review v2 — a pure capture tool, same philosophy as the Daily
// Review (see CLAUDE.md). This file holds the vocabulary that has to be
// a stable, shared constant (regime/grade/self-grade option lists, the
// Demon Finder's eight fixed rows, the shadow-text prompts) plus the
// couple of field normalizers unique to this page. Ticker normalization,
// the focus slider parser, and the optional-number parser are reused
// verbatim from lib/validation/daily-review.ts — not rebuilt here.

export const WEEKLY_REGIME_OPTIONS: WeeklyRegime[] = [
  "Strong Uptrend",
  "Uptrend",
  "Choppy/Mixed",
  "Downtrend",
  "Strong Downtrend",
];

export const WEEKLY_MENTAL_TAGS: string[] = [
  "FOMO",
  "Frustration",
  "Angst",
  "Euphorie",
  "Unsicherheit",
  "Overconfidence",
  "Langeweile",
  "Revenge",
  "Fremdeinfluss/Guru-Bias",
  "Keine relevante Beeinflussung",
];

export const WEEKLY_TRADE_SEITE_OPTIONS: WeeklyReviewTradeSeite[] = ["Long", "Short"];
export const WEEKLY_TRADE_GRADE_OPTIONS: WeeklyReviewTradeGrade[] = ["A", "B", "C", "D"];
export const WEEKLY_PROZESS_VS_ERGEBNIS_OPTIONS: WeeklyReviewProzessVsErgebnis[] = [
  "gut trotz Verlust",
  "schlecht trotz Gewinn",
  "Ergebnis deckt sich mit Prozess",
];
export const WEEKLY_SELF_GRADE_OPTIONS: WeeklySelfGrade[] = ["1", "2", "3", "4", "5", "6"];

/** §3 Block 8 — Demon Finder's eight fixed rows, exact order, exact German labels. */
export const WEEKLY_DEMON_ITEMS: { key: string; label: string }[] = [
  { key: "overtrading", label: "Overtrading / B-Ticker statt Prime" },
  { key: "fomo_entry", label: "FOMO-Entry" },
  { key: "undersized", label: "Undersized im richtigen Chart (Re-Entry/Re-Add verpasst)" },
  { key: "early_exit", label: "Zu früher Exit / Nerven-Exit statt EMA10-Close" },
  { key: "euphoria_leak", label: "Euphorie-Leck am Hoch (Softening, Size-Up, Screenshot-Impuls)" },
  { key: "foreign_system", label: "Fremdsystem gehandelt (Guru statt Playbook)" },
  { key: "sitting_out", label: "Aussitzen / Stop geweitet" },
  { key: "intraday_uncovered", label: "Intraday-Fund ohne Watchlist-Deckung" },
];

/** §7 — the static leitfragen hint text shown above the Missed-Review cards. Never persisted, not a field. */
export const WEEKLY_MISSED_LEITFRAGEN =
  "Warum sah der Chart nach meinem A+ aus? · Was war es formal (Struktur, Trigger, Reife)? · Gab es einen regelkonformen Entry, und welcher Trigger hätte gehalten (m5/m15/m30/PDH-BO/PB-Entry)? · Warum habe ich ihn nicht genommen — oder war es kein Miss, sondern ein reines Musterbeispiel? · Was hätte ich in Echtzeit wissen können?";

/** §12 — always goes into the export, even on an otherwise empty week. Not editable, not stored as a field. */
export const WEEKLY_HANDOVER_MARKDOWN = `## 12 · ÜBERGABE AN DIE KI-INSTANZ

Daily Reviews der Woche werden separat mitgeliefert — daraus entstehen Block 1 (Zahlen,
Guardrail-Bilanz), Block 6 (Shadow Log inkl. Performance-Verlauf) sowie Datum und
R-Ergebnis der Trade-Karten.

Auftrag: nicht zustimmen, sondern prüfen.
1. Was war objektiv mein stärkster Prozess dieser Woche?
2. Was war objektiv mein größtes Leak?
3. Welche meiner eigenen Schlussfolgerungen sind durch die Daten nicht gedeckt?
4. Welches Muster wiederholt sich über mehrere Wochen?
5. Was sollte nächste Woche konkret anders laufen?
6. Welche EINE Sache hat aktuell den größten erwarteten Einfluss auf meine Performance?`;

// Shadow-text prompts — verbatim from the spec, never paraphrased. They
// vanish on typing and are never persisted, same convention as Daily
// Review's SHADOW_TEXTS.
export const WEEKLY_SHADOW_TEXTS = {
  bruecke: "Wo habe ich selbst die größten Brüche und Probleme gesehen?",
  biasFlipText: "Wann war er erkennbar?",
  leadership: "stark / schwach",
  mentalText: "Hat der Zustand Entscheidungen beeinflusst — wo konkret?",
  staerksteNamen: "Nach Stärke geordnet, kommagetrennt.",
  gehandelt: "Kommagetrennt.",
  nichtGehandelt: "Kommagetrennt.",
  verpasst: "Kommagetrennt.",
  guterSkip: "Stark, aber kein Entry nach System. Kommagetrennt.",
  gemeinsameEigenschaften: "Was will ich visuell internalisieren?",
  worstTradeText: "Was hätte stattdessen passieren müssen?",
  wiederholungText: "Seit wann / wie oft?",
  goodTradeText: "Was lief außergewöhnlich gut, wovon will ich mehr?",
  rolleWarum: "Warum?",
  selfGradeBegruendung: "",
  regel: "Wenn nur EINE Sache besser wird.",
  regelKonkret: "Bedingung → Handlung.",
  regelPruefung: "Woran erkenne ich nächsten Samstag, dass ich sie umgesetzt habe?",
  ideaCapture: "Übergabe ins Idea Capture, Status OFFEN.",
} as const;
