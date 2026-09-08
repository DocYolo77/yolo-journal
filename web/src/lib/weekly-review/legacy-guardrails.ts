// Moved out of the old lib/validation/daily-review.ts (deleted in the
// v2 rewrite — the new Daily Review guardrail model is a fixed
// click-list of nine keys, see lib/validation/daily-review.ts's
// DAILY_REVIEW_GUARDRAILS). This canonical id/label list is kept only
// because lib/weekly-review/compute.ts's guardrail-compliance
// breakdown still reads the pre-v2 daily_reviews_legacy.guardrails
// jsonb shape, which used these ids.

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
