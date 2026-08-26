"use server";

import { revalidatePath } from "next/cache";
import {
  closeCryptoTrade,
  createCryptoTrade,
  getCryptoTrade,
  reopenCryptoTrade,
  updateCryptoTrade,
  updateCryptoTradeAftercare,
  uploadCryptoScreenshot,
} from "@/lib/data/crypto-trades";
import {
  createCryptoLearningFromTrade,
  deleteCryptoLearning,
  moveCryptoLearning,
  updateCryptoLearning,
} from "@/lib/data/crypto-learnings";
import { upsertCryptoWeeklyReview } from "@/lib/data/crypto-weekly-review";
import type { CryptoLearningRow, CryptoTradeRow } from "@/lib/supabase/types";
import {
  parseCryptoLearningInput,
  parseCryptoTradeQuickAdd,
  parseCryptoTradeUpdate,
  parseCryptoWeeklyReviewInput,
} from "@/lib/validation/crypto";

// Plain async Server Actions invoked directly from client onClick
// handlers (not via <form action>/useActionState) — same pattern already
// established for Lessons Learned and (after the Coaching Take data-loss
// bug) Daily Review's screenshot/AI actions: avoids the nested-form class
// of bug entirely and keeps file uploads (FormData with real File
// entries) simple to reason about.

function revalidateCryptoPaths(tradeId?: string) {
  revalidatePath("/crypto");
  revalidatePath("/crypto/learnings");
  revalidatePath("/crypto/weekly-review");
  if (tradeId) revalidatePath(`/crypto/${tradeId}`);
}

export async function createCryptoTradeAction(
  formData: FormData
): Promise<{ data: CryptoTradeRow | null; error: string | null }> {
  const parsed = parseCryptoTradeQuickAdd(formData);
  if (!parsed.success) return { data: null, error: parsed.error };

  const result = await createCryptoTrade(parsed.data);
  revalidateCryptoPaths();
  return result;
}

export async function updateCryptoTradeAction(
  id: string,
  formData: FormData
): Promise<{ data: CryptoTradeRow | null; error: string | null }> {
  const existing = await getCryptoTrade(id);
  if (!existing.data) return { data: null, error: existing.error ?? "Trade nicht gefunden." };
  if (existing.data.status === "CLOSED") {
    return { data: null, error: "Trade ist abgeschlossen — Basisdaten sind gesperrt. Erst wieder öffnen." };
  }

  const parsed = parseCryptoTradeUpdate(formData);
  if (!parsed.success) return { data: null, error: parsed.error };

  const result = await updateCryptoTrade(id, parsed.data);
  revalidateCryptoPaths(id);
  return result;
}

/** Always allowed, even on a CLOSED trade — review/lesson text stays editable for aftercare. */
export async function updateCryptoTradeAftercareAction(
  id: string,
  formData: FormData
): Promise<{ data: CryptoTradeRow | null; error: string | null }> {
  const result = await updateCryptoTradeAftercare(id, {
    review_good: (formData.get("review_good") as string | null)?.trim() || null,
    review_bad: (formData.get("review_bad") as string | null)?.trim() || null,
    review_better: (formData.get("review_better") as string | null)?.trim() || null,
    lesson: (formData.get("lesson") as string | null)?.trim() || null,
  });
  revalidateCryptoPaths(id);
  return result;
}

export async function uploadCryptoScreenshotAction(
  id: string,
  slot: "entry" | "after",
  formData: FormData
): Promise<{ error: string | null }> {
  const file = formData.get("screenshot");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Keine Datei ausgewählt." };
  }

  if (slot === "entry") {
    const existing = await getCryptoTrade(id);
    if (!existing.data) return { error: existing.error ?? "Trade nicht gefunden." };
    if (existing.data.status === "CLOSED") {
      return { error: "Trade ist abgeschlossen — Entry Screenshot ist gesperrt." };
    }
  }

  const result = await uploadCryptoScreenshot(id, slot, file);
  revalidateCryptoPaths(id);
  return { error: result.error };
}

export async function closeCryptoTradeAction(id: string): Promise<{ data: CryptoTradeRow | null; error: string | null }> {
  const result = await closeCryptoTrade(id);
  revalidateCryptoPaths(id);
  return result;
}

export async function reopenCryptoTradeAction(id: string): Promise<{ data: CryptoTradeRow | null; error: string | null }> {
  const result = await reopenCryptoTrade(id);
  revalidateCryptoPaths(id);
  return result;
}

export async function addCryptoLessonToLearningsAction(
  tradeId: string,
  tags: string[]
): Promise<{ data: CryptoLearningRow | null; error: string | null }> {
  const trade = await getCryptoTrade(tradeId);
  if (!trade.data) return { data: null, error: trade.error ?? "Trade nicht gefunden." };

  const result = await createCryptoLearningFromTrade(trade.data, tags);
  revalidateCryptoPaths(tradeId);
  return result;
}

export async function updateCryptoLearningAction(
  id: string,
  formData: FormData
): Promise<{ data: CryptoLearningRow | null; error: string | null }> {
  const parsed = parseCryptoLearningInput(formData);
  if (!parsed.success) return { data: null, error: parsed.error };

  const result = await updateCryptoLearning(id, parsed.data);
  revalidateCryptoPaths();
  return result;
}

export async function deleteCryptoLearningAction(id: string): Promise<{ error: string | null }> {
  const result = await deleteCryptoLearning(id);
  revalidateCryptoPaths();
  return result;
}

export async function moveCryptoLearningAction(id: string, direction: "up" | "down"): Promise<{ error: string | null }> {
  const result = await moveCryptoLearning(id, direction);
  revalidateCryptoPaths();
  return result;
}

export async function saveCryptoWeeklyReviewAction(
  weekStart: string,
  weekEnd: string,
  formData: FormData
): Promise<{ error: string | null }> {
  const input = parseCryptoWeeklyReviewInput(formData);
  const result = await upsertCryptoWeeklyReview(weekStart, weekEnd, input);
  revalidatePath("/crypto/weekly-review");
  return { error: result.error };
}
