"use server";

import { revalidatePath } from "next/cache";
import {
  addTradeCard,
  addWatchlistTicker,
  buildMarkdownExport,
  clearGuardrailStatus,
  getDailyReviewData,
  getFieldSuggestions,
  removeTradeCard,
  removeWatchlistTicker,
  setGuardrailStatus,
  updateDailyReviewFields,
  updateTradeCard,
  updateWatchlistTicker,
  type DailyReviewFieldPatch,
  type TradeAutocompleteField,
} from "@/lib/data/daily-review";
import type { DailyReviewGuardrailStatus, DailyReviewWatchlistScope } from "@/lib/supabase/types";

// Thin server-action wrappers around lib/data/daily-review.ts, called
// directly from the client autosave logic in daily-review-form.tsx
// (not through <form action=...> — every field saves independently on
// its own debounce, there is no single page-level submit).

export async function updateReviewFieldsAction(reviewId: string, patch: DailyReviewFieldPatch): Promise<{ error: string | null }> {
  const result = await updateDailyReviewFields(reviewId, patch);
  if (!result.error) revalidatePath("/daily-review");
  return result;
}

export async function addWatchlistTickerAction(reviewId: string, scope: DailyReviewWatchlistScope, ticker: string) {
  const result = await addWatchlistTicker(reviewId, scope, ticker);
  if (!result.error) revalidatePath("/daily-review");
  return result;
}

export async function updateWatchlistTickerAction(id: string, patch: { taken?: boolean; note?: string | null; ticker?: string }) {
  const result = await updateWatchlistTicker(id, patch);
  if (!result.error) revalidatePath("/daily-review");
  return result;
}

export async function removeWatchlistTickerAction(id: string) {
  const result = await removeWatchlistTicker(id);
  if (!result.error) revalidatePath("/daily-review");
  return result;
}

export async function addTradeCardAction(reviewId: string) {
  const result = await addTradeCard(reviewId);
  if (!result.error) revalidatePath("/daily-review");
  return result;
}

export async function updateTradeCardAction(
  id: string,
  patch: Partial<{ ticker: string; setup: string; trigger_tactic: string; stop_logic: string; what_happened: string; my_thinking: string }>
) {
  const result = await updateTradeCard(id, patch);
  if (!result.error) revalidatePath("/daily-review");
  return result;
}

export async function removeTradeCardAction(id: string) {
  const result = await removeTradeCard(id);
  if (!result.error) revalidatePath("/daily-review");
  return result;
}

export async function setGuardrailStatusAction(
  reviewId: string,
  guardrailKey: string,
  status: DailyReviewGuardrailStatus,
  notes: string | null
) {
  const result = await setGuardrailStatus(reviewId, guardrailKey, status, notes);
  if (!result.error) revalidatePath("/daily-review");
  return result;
}

export async function clearGuardrailStatusAction(reviewId: string, guardrailKey: string) {
  const result = await clearGuardrailStatus(reviewId, guardrailKey);
  if (!result.error) revalidatePath("/daily-review");
  return result;
}

export async function getFieldSuggestionsAction(field: TradeAutocompleteField): Promise<string[]> {
  return getFieldSuggestions(field);
}

export async function getMarkdownExportAction(tradeDate: string): Promise<{ data: string; error: null } | { data: null; error: string }> {
  const result = await getDailyReviewData(tradeDate);
  if (result.error || !result.data) {
    return { data: null, error: result.error ?? "Markdown-Export konnte nicht erstellt werden." };
  }
  return { data: buildMarkdownExport(result.data), error: null };
}
