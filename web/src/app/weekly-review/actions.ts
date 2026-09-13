"use server";

import { revalidatePath } from "next/cache";
import {
  addMissedCard,
  addWeeklyTradeCard,
  buildWeeklyMarkdownExport,
  getWeeklyReviewData,
  getWeeklyTickerSuggestions,
  removeMissedCard,
  removeWeeklyTradeCard,
  setDemonState,
  updateMissedCard,
  updateWeeklyReviewFields,
  updateWeeklyTradeCard,
  type WeeklyReviewFieldPatch,
} from "@/lib/data/weekly-review";

// Thin server-action wrappers around lib/data/weekly-review.ts, called
// directly from the client autosave logic in weekly-review-form.tsx —
// same "no <form action>, every field saves independently" pattern as
// app/daily-review/actions.ts.

export async function updateWeeklyReviewFieldsAction(reviewId: string, patch: WeeklyReviewFieldPatch): Promise<{ error: string | null }> {
  const result = await updateWeeklyReviewFields(reviewId, patch);
  if (!result.error) revalidatePath("/weekly-review");
  return result;
}

export async function addWeeklyTradeCardAction(reviewId: string) {
  const result = await addWeeklyTradeCard(reviewId);
  if (!result.error) revalidatePath("/weekly-review");
  return result;
}

export async function updateWeeklyTradeCardAction(
  id: string,
  patch: Partial<{
    ticker: string;
    seite: string | null;
    setup: string | null;
    trigger_tactic: string | null;
    verlauf: string | null;
    grade_selektion: string | null;
    grade_entry: string | null;
    grade_management: string | null;
    prozess_vs_ergebnis: string | null;
    chart_url: string | null;
  }>
) {
  const result = await updateWeeklyTradeCard(id, patch);
  if (!result.error) revalidatePath("/weekly-review");
  return result;
}

export async function removeWeeklyTradeCardAction(id: string) {
  const result = await removeWeeklyTradeCard(id);
  if (!result.error) revalidatePath("/weekly-review");
  return result;
}

export async function addMissedCardAction(reviewId: string) {
  const result = await addMissedCard(reviewId);
  if (!result.error) revalidatePath("/weekly-review");
  return result;
}

export async function updateMissedCardAction(id: string, patch: Partial<{ ticker: string; chart_url: string | null; text: string | null }>) {
  const result = await updateMissedCard(id, patch);
  if (!result.error) revalidatePath("/weekly-review");
  return result;
}

export async function removeMissedCardAction(id: string) {
  const result = await removeMissedCard(id);
  if (!result.error) revalidatePath("/weekly-review");
  return result;
}

export async function setDemonStateAction(reviewId: string, demonKey: string, aktiv: boolean, text: string | null) {
  const result = await setDemonState(reviewId, demonKey, aktiv, text);
  if (!result.error) revalidatePath("/weekly-review");
  return result;
}

export async function getWeeklyTickerSuggestionsAction(): Promise<string[]> {
  return getWeeklyTickerSuggestions();
}

export async function getWeeklyMarkdownExportAction(
  weekStart: string,
  weekEnd: string
): Promise<{ data: string; error: null } | { data: null; error: string }> {
  const result = await getWeeklyReviewData(weekStart, weekEnd);
  if (result.error || !result.data) {
    return { data: null, error: result.error ?? "Markdown-Export konnte nicht erstellt werden." };
  }
  return { data: buildWeeklyMarkdownExport(result.data), error: null };
}
