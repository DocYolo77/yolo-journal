"use server";

import { revalidatePath } from "next/cache";
import { updateWatchlistTicker } from "@/lib/data/daily-review";
import { buildShadowlistStoryPng, getShadowlistEntries, type ShadowlistEntry } from "@/lib/data/shadowlist";
import { getDailyReviewData } from "@/lib/data/daily-review";

export async function updateShadowlistTickerAction(id: string, patch: { taken?: boolean; note?: string | null }) {
  const result = await updateWatchlistTicker(id, patch);
  if (!result.error) revalidatePath("/shadowlist");
  return result;
}

export async function exportShadowlistPngAction(
  tradeDate: string
): Promise<{ data: string; error: null } | { data: null; error: string }> {
  const dataResult = await getDailyReviewData(tradeDate);
  if (dataResult.error || !dataResult.data) {
    return { data: null, error: dataResult.error ?? "Shadowlist konnte nicht geladen werden." };
  }
  const entries: ShadowlistEntry[] = await getShadowlistEntries(tradeDate, dataResult.data.watchlistToday);
  return buildShadowlistStoryPng(tradeDate, entries);
}
