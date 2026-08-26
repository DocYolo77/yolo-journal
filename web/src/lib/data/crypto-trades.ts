import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { CryptoTradeRow } from "@/lib/supabase/types";
import type { CryptoTradeQuickAddInput, CryptoTradeUpdateInput } from "@/lib/validation/crypto";

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

const SCREENSHOTS_BUCKET = "crypto-screenshots";
// Long enough to cover a full page view without re-signing per request,
// short enough that a leaked link doesn't stay valid indefinitely — same
// tradeoff already accepted for the private "reports" PDF bucket.
const SIGNED_URL_TTL_SECONDS = 60 * 60;

async function ensureScreenshotsBucket(supabase: SupabaseAdminClient): Promise<string | null> {
  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) return `Screenshot-Bucket konnte nicht geprüft werden: ${listError.message}`;
    if (buckets?.some((b) => b.name === SCREENSHOTS_BUCKET)) return null;

    const { error: createError } = await supabase.storage.createBucket(SCREENSHOTS_BUCKET, { public: false });
    if (createError) return `Screenshot-Bucket konnte nicht erstellt werden: ${createError.message}`;
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "Screenshot-Bucket konnte nicht erstellt werden.";
  }
}

export async function listCryptoTrades(): Promise<
  { data: CryptoTradeRow[]; error: null } | { data: null; error: string }
> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("crypto_trades")
      .select("*")
      .order("trade_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("listCryptoTrades failed", error);
      return { data: null, error: "Crypto-Trades konnten nicht geladen werden." };
    }
    return { data: (data ?? []) as CryptoTradeRow[], error: null };
  } catch (e) {
    console.error("listCryptoTrades failed", e);
    return { data: null, error: "Crypto-Trades konnten nicht geladen werden." };
  }
}

export async function getCryptoTrade(
  id: string
): Promise<{ data: CryptoTradeRow | null; error: null } | { data: null; error: string }> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("crypto_trades").select("*").eq("id", id).maybeSingle();

    if (error) {
      console.error("getCryptoTrade failed", error);
      return { data: null, error: "Crypto-Trade konnte nicht geladen werden." };
    }
    return { data: (data as CryptoTradeRow | null) ?? null, error: null };
  } catch (e) {
    console.error("getCryptoTrade failed", e);
    return { data: null, error: "Crypto-Trade konnte nicht geladen werden." };
  }
}

export async function createCryptoTrade(
  input: CryptoTradeQuickAddInput
): Promise<{ data: CryptoTradeRow; error: null } | { data: null; error: string }> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("crypto_trades")
      .insert({ ...input, status: "OPEN" })
      .select("*")
      .single();

    if (error || !data) {
      console.error("createCryptoTrade failed", error);
      return { data: null, error: "Trade konnte nicht angelegt werden." };
    }
    return { data: data as CryptoTradeRow, error: null };
  } catch (e) {
    console.error("createCryptoTrade failed", e);
    return { data: null, error: "Trade konnte nicht angelegt werden." };
  }
}

/**
 * Full-field update. Callers must gate this on the trade still being
 * OPEN for the "Basisdaten"/management fields — a CLOSED trade's basics
 * and management are meant to be locked, per spec ("gilt als final und
 * soll anschließend nicht mehr versehentlich verändert werden"). The
 * always-editable fields (after-screenshot, review, lesson) go through
 * updateCryptoTradeAftercare instead, which has no such gate.
 */
export async function updateCryptoTrade(
  id: string,
  input: CryptoTradeUpdateInput
): Promise<{ data: CryptoTradeRow; error: null } | { data: null; error: string }> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("crypto_trades").update(input).eq("id", id).select("*").single();

    if (error || !data) {
      console.error("updateCryptoTrade failed", error);
      return { data: null, error: "Trade konnte nicht gespeichert werden." };
    }
    return { data: data as CryptoTradeRow, error: null };
  } catch (e) {
    console.error("updateCryptoTrade failed", e);
    return { data: null, error: "Trade konnte nicht gespeichert werden." };
  }
}

/** Fields that stay editable after a trade is CLOSED (after-screenshot handled separately via uploadCryptoScreenshot). */
export type CryptoTradeAftercareInput = {
  review_good: string | null;
  review_bad: string | null;
  review_better: string | null;
  lesson: string | null;
};

export async function updateCryptoTradeAftercare(
  id: string,
  input: CryptoTradeAftercareInput
): Promise<{ data: CryptoTradeRow; error: null } | { data: null; error: string }> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("crypto_trades").update(input).eq("id", id).select("*").single();

    if (error || !data) {
      console.error("updateCryptoTradeAftercare failed", error);
      return { data: null, error: "Nachbereitung konnte nicht gespeichert werden." };
    }
    return { data: data as CryptoTradeRow, error: null };
  } catch (e) {
    console.error("updateCryptoTradeAftercare failed", e);
    return { data: null, error: "Nachbereitung konnte nicht gespeichert werden." };
  }
}

export async function closeCryptoTrade(
  id: string
): Promise<{ data: CryptoTradeRow; error: null } | { data: null; error: string }> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("crypto_trades")
      .update({ status: "CLOSED", closed_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();

    if (error || !data) {
      console.error("closeCryptoTrade failed", error);
      return { data: null, error: "Trade konnte nicht abgeschlossen werden." };
    }
    return { data: data as CryptoTradeRow, error: null };
  } catch (e) {
    console.error("closeCryptoTrade failed", e);
    return { data: null, error: "Trade konnte nicht abgeschlossen werden." };
  }
}

export async function reopenCryptoTrade(
  id: string
): Promise<{ data: CryptoTradeRow; error: null } | { data: null; error: string }> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("crypto_trades")
      .update({ status: "OPEN", closed_at: null })
      .eq("id", id)
      .select("*")
      .single();

    if (error || !data) {
      console.error("reopenCryptoTrade failed", error);
      return { data: null, error: "Trade konnte nicht wieder geöffnet werden." };
    }
    return { data: data as CryptoTradeRow, error: null };
  } catch (e) {
    console.error("reopenCryptoTrade failed", e);
    return { data: null, error: "Trade konnte nicht wieder geöffnet werden." };
  }
}

function extensionFromFile(file: File): string {
  const fromName = file.name.split(".").pop();
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

/** Uploads an entry/after screenshot, storing only the path (not a URL) on the trade row. */
export async function uploadCryptoScreenshot(
  tradeId: string,
  slot: "entry" | "after",
  file: File
): Promise<{ path: string | null; error: string | null }> {
  try {
    const supabase = getSupabaseAdmin();
    const bucketError = await ensureScreenshotsBucket(supabase);
    if (bucketError) return { path: null, error: bucketError };

    const path = `${tradeId}/${slot}.${extensionFromFile(file)}`;
    const { error: uploadError } = await supabase.storage
      .from(SCREENSHOTS_BUCKET)
      .upload(path, file, { contentType: file.type || undefined, upsert: true });

    if (uploadError) {
      console.error("uploadCryptoScreenshot: upload failed", uploadError);
      return { path: null, error: "Screenshot konnte nicht hochgeladen werden." };
    }

    const column = slot === "entry" ? "entry_screenshot_path" : "after_screenshot_path";
    const { error: updateError } = await supabase.from("crypto_trades").update({ [column]: path }).eq("id", tradeId);
    if (updateError) {
      console.error("uploadCryptoScreenshot: trade row update failed", updateError);
      return { path: null, error: "Screenshot-Pfad konnte nicht gespeichert werden." };
    }

    return { path, error: null };
  } catch (e) {
    console.error("uploadCryptoScreenshot failed", e);
    return { path: null, error: "Screenshot konnte nicht hochgeladen werden." };
  }
}

/** Generates a fresh time-limited signed URL for a stored screenshot path — paths never expire, signed URLs do. */
export async function getCryptoScreenshotSignedUrls(paths: {
  entry: string | null;
  after: string | null;
}): Promise<{ entry: string | null; after: string | null }> {
  const supabase = getSupabaseAdmin();
  const [entry, after] = await Promise.all([
    paths.entry
      ? supabase.storage.from(SCREENSHOTS_BUCKET).createSignedUrl(paths.entry, SIGNED_URL_TTL_SECONDS)
      : Promise.resolve(null),
    paths.after
      ? supabase.storage.from(SCREENSHOTS_BUCKET).createSignedUrl(paths.after, SIGNED_URL_TTL_SECONDS)
      : Promise.resolve(null),
  ]);

  return {
    entry: entry && !entry.error ? entry.data.signedUrl : null,
    after: after && !after.error ? after.data.signedUrl : null,
  };
}
