import type { CryptoDirection, CryptoProduct } from "@/lib/supabase/types";
import { isValidTradeDate } from "@/lib/trade-date";

export const CRYPTO_DIRECTIONS: CryptoDirection[] = ["LONG", "SHORT"];
export const CRYPTO_PRODUCTS: CryptoProduct[] = ["SPOT", "PERP"];

function toNullableNumber(value: FormDataEntryValue | null): number | null {
  if (value === null) return null;
  const trimmed = String(value).trim();
  if (trimmed === "") return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

function toNullableText(value: FormDataEntryValue | null): string | null {
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

/** Minimal fields for a quick-add trade — everything else can be filled in afterwards on the detail page. */
export type CryptoTradeQuickAddInput = {
  trade_date: string;
  coin: string;
  direction: CryptoDirection;
  product: CryptoProduct;
};

export function parseCryptoTradeQuickAdd(
  formData: FormData
): { success: true; data: CryptoTradeQuickAddInput } | { success: false; error: string } {
  const tradeDate = String(formData.get("trade_date") ?? "").trim();
  const coin = String(formData.get("coin") ?? "").trim();
  const direction = String(formData.get("direction") ?? "");
  const product = String(formData.get("product") ?? "");

  if (!isValidTradeDate(tradeDate)) return { success: false, error: "Ungültiges Datum." };
  if (!coin) return { success: false, error: "Coin ist erforderlich." };
  if (!CRYPTO_DIRECTIONS.includes(direction as CryptoDirection)) return { success: false, error: "Ungültige Richtung." };
  if (!CRYPTO_PRODUCTS.includes(product as CryptoProduct)) return { success: false, error: "Ungültiges Produkt." };

  return {
    success: true,
    data: { trade_date: tradeDate, coin: coin.toUpperCase(), direction: direction as CryptoDirection, product: product as CryptoProduct },
  };
}

/** Full editable field set on the trade detail page (screenshots handled separately as File uploads). */
export type CryptoTradeUpdateInput = {
  trade_date: string;
  coin: string;
  direction: CryptoDirection;
  product: CryptoProduct;
  risk_usd: number | null;
  risk_pct: number | null;
  result_usd: number | null;
  result_r: number | null;
  thesis: string | null;
  management: string | null;
  review_good: string | null;
  review_bad: string | null;
  review_better: string | null;
  lesson: string | null;
};

export function parseCryptoTradeUpdate(
  formData: FormData
): { success: true; data: CryptoTradeUpdateInput } | { success: false; error: string } {
  const tradeDate = String(formData.get("trade_date") ?? "").trim();
  const coin = String(formData.get("coin") ?? "").trim();
  const direction = String(formData.get("direction") ?? "");
  const product = String(formData.get("product") ?? "");

  if (!isValidTradeDate(tradeDate)) return { success: false, error: "Ungültiges Datum." };
  if (!coin) return { success: false, error: "Coin ist erforderlich." };
  if (!CRYPTO_DIRECTIONS.includes(direction as CryptoDirection)) return { success: false, error: "Ungültige Richtung." };
  if (!CRYPTO_PRODUCTS.includes(product as CryptoProduct)) return { success: false, error: "Ungültiges Produkt." };

  return {
    success: true,
    data: {
      trade_date: tradeDate,
      coin: coin.toUpperCase(),
      direction: direction as CryptoDirection,
      product: product as CryptoProduct,
      risk_usd: toNullableNumber(formData.get("risk_usd")),
      risk_pct: toNullableNumber(formData.get("risk_pct")),
      result_usd: toNullableNumber(formData.get("result_usd")),
      result_r: toNullableNumber(formData.get("result_r")),
      thesis: toNullableText(formData.get("thesis")),
      management: toNullableText(formData.get("management")),
      review_good: toNullableText(formData.get("review_good")),
      review_bad: toNullableText(formData.get("review_bad")),
      review_better: toNullableText(formData.get("review_better")),
      lesson: toNullableText(formData.get("lesson")),
    },
  };
}

export type CryptoLearningInput = {
  lesson: string;
  tags: string[];
};

export function parseCryptoLearningInput(
  formData: FormData
): { success: true; data: CryptoLearningInput } | { success: false; error: string } {
  const lesson = String(formData.get("lesson") ?? "").trim();
  if (!lesson) return { success: false, error: "Lesson darf nicht leer sein." };

  const tagsRaw = String(formData.get("tags") ?? "");
  const tags = tagsRaw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  return { success: true, data: { lesson, tags } };
}

export type CryptoWeeklyReviewInput = {
  good: string | null;
  bad: string | null;
  learned: string | null;
  focus_next_week: string | null;
};

export function parseCryptoWeeklyReviewInput(formData: FormData): CryptoWeeklyReviewInput {
  return {
    good: toNullableText(formData.get("good")),
    bad: toNullableText(formData.get("bad")),
    learned: toNullableText(formData.get("learned")),
    focus_next_week: toNullableText(formData.get("focus_next_week")),
  };
}
