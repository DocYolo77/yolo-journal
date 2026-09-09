import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { CryptoTradeRow } from "@/lib/supabase/types";
import type { CryptoTradeQuickAddInput, CryptoTradeUpdateInput } from "@/lib/validation/crypto";

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
 * always-editable fields (after-chart link, review, lesson) go through
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

/** Fields that stay editable after a trade is CLOSED. */
export type CryptoTradeAftercareInput = {
  after_tradingview_url: string | null;
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

