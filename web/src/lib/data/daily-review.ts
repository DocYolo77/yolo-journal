import { getSupabaseAdmin } from "@/lib/supabase/server";
import type {
  DailyReviewRow,
  DailyReviewWatchlistRow,
  DailyReviewTradeRow,
  DailyReviewGuardrailRow,
  DailyReviewGuardrailStatus,
} from "@/lib/supabase/types";
import { DAILY_REVIEW_GUARDRAILS, GUARDRAIL_STATUS_LABELS } from "@/lib/validation/daily-review";

// v2 Daily Review data layer — a pure capture tool. Every function here
// stores or retrieves inputs; none of them judge, enforce, or compute.
// See CLAUDE.md / the "Umbau-Anweisung v2"+v2.1 specs for the product
// rationale, and lib/weekly-review/{fetch,compute}.ts for the separate,
// untouched pre-v2 data layer Weekly Review still reads.
//
// v2.1 removed the watchlist today/next split and the prior-review
// carry-forward prefill entirely — one watchlist per day, entered in
// the morning, no lock, no copy mechanic.

const POSTGRES_UNIQUE_VIOLATION = "23505";

export type DailyReviewData = {
  review: DailyReviewRow;
  watchlist: DailyReviewWatchlistRow[];
  trades: DailyReviewTradeRow[];
  guardrails: DailyReviewGuardrailRow[];
};

/**
 * Gets the daily_reviews row for tradeDate, creating an empty one if
 * it doesn't exist yet. Idempotent under concurrent calls via
 * unique(trade_date) + a unique-violation retry, same pattern as the
 * rest of this codebase's insert-based idempotency.
 */
export async function getOrCreateDailyReview(
  tradeDate: string
): Promise<{ data: DailyReviewRow; error: null } | { data: null; error: string }> {
  try {
    const supabase = getSupabaseAdmin();

    const { data: existing, error: selectError } = await supabase
      .from("daily_reviews")
      .select("*")
      .eq("trade_date", tradeDate)
      .maybeSingle();

    if (selectError) {
      console.error("getOrCreateDailyReview: select failed", selectError);
      return { data: null, error: "Daily Review konnte nicht geladen werden." };
    }

    if (existing) {
      return { data: existing as DailyReviewRow, error: null };
    }

    const { data: inserted, error: insertError } = await supabase
      .from("daily_reviews")
      .insert({ trade_date: tradeDate })
      .select("*")
      .single();

    if (insertError) {
      if (insertError.code === POSTGRES_UNIQUE_VIOLATION) {
        const { data: retried, error: retryError } = await supabase
          .from("daily_reviews")
          .select("*")
          .eq("trade_date", tradeDate)
          .single();
        if (retryError || !retried) {
          console.error("getOrCreateDailyReview: retry-after-conflict failed", retryError);
          return { data: null, error: "Daily Review konnte nicht geladen werden." };
        }
        return { data: retried as DailyReviewRow, error: null };
      }
      console.error("getOrCreateDailyReview: insert failed", insertError);
      return { data: null, error: "Daily Review konnte nicht angelegt werden." };
    }

    return { data: inserted as DailyReviewRow, error: null };
  } catch (e) {
    console.error("getOrCreateDailyReview failed", e);
    return { data: null, error: "Daily Review konnte nicht geladen werden." };
  }
}

export async function getDailyReviewData(
  tradeDate: string
): Promise<{ data: DailyReviewData; error: null } | { data: null; error: string }> {
  const reviewResult = await getOrCreateDailyReview(tradeDate);
  if (reviewResult.error || !reviewResult.data) {
    return { data: null, error: reviewResult.error ?? "Daily Review konnte nicht geladen werden." };
  }
  const review = reviewResult.data;

  try {
    const supabase = getSupabaseAdmin();

    const [{ data: watchlist }, { data: trades }, { data: guardrails }] = await Promise.all([
      supabase.from("daily_review_watchlist").select("*").eq("review_id", review.id).order("sort_order"),
      supabase.from("daily_review_trades").select("*").eq("review_id", review.id).order("sort_order"),
      supabase.from("daily_review_guardrails").select("*").eq("review_id", review.id),
    ]);

    return {
      data: {
        review,
        watchlist: (watchlist ?? []) as DailyReviewWatchlistRow[],
        trades: (trades ?? []) as DailyReviewTradeRow[],
        guardrails: (guardrails ?? []) as DailyReviewGuardrailRow[],
      },
      error: null,
    };
  } catch (e) {
    console.error("getDailyReviewData failed", e);
    return { data: null, error: "Daily Review konnte nicht geladen werden." };
  }
}

export type DailyReviewFieldPatch = Partial<
  Pick<
    DailyReviewRow,
    | "risk_pct"
    | "r_value_usd"
    | "nlv_close"
    | "self_grade"
    | "market_context"
    | "personal_state"
    | "focus_level"
    | "what_went_well"
    | "what_went_wrong"
    | "what_to_improve"
    | "guardrails_note"
    | "session_plan"
    | "opportunity_spike"
  >
>;

/** Generic partial update of the flat daily_reviews columns — the autosave target for every text/number field in blocks 1, 2, 3, 4, 6. */
export async function updateDailyReviewFields(reviewId: string, patch: DailyReviewFieldPatch): Promise<{ error: string | null }> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("daily_reviews").update(patch).eq("id", reviewId);
    if (error) {
      console.error("updateDailyReviewFields failed", error);
      return { error: "Änderung konnte nicht gespeichert werden." };
    }
    return { error: null };
  } catch (e) {
    console.error("updateDailyReviewFields failed", e);
    return { error: "Änderung konnte nicht gespeichert werden." };
  }
}

export async function addWatchlistTicker(
  reviewId: string,
  ticker: string
): Promise<{ data: DailyReviewWatchlistRow; error: null } | { data: null; error: string }> {
  try {
    const supabase = getSupabaseAdmin();
    const { data: lastRow } = await supabase
      .from("daily_review_watchlist")
      .select("sort_order")
      .eq("review_id", reviewId)
      .order("sort_order", { ascending: false })
      .limit(1);
    const nextSortOrder = lastRow && lastRow.length > 0 ? (lastRow[0].sort_order as number) + 1 : 0;

    const { data, error } = await supabase
      .from("daily_review_watchlist")
      .insert({ review_id: reviewId, ticker, sort_order: nextSortOrder })
      .select("*")
      .single();

    if (error || !data) {
      console.error("addWatchlistTicker failed", error);
      return { data: null, error: "Ticker konnte nicht hinzugefügt werden." };
    }
    return { data: data as DailyReviewWatchlistRow, error: null };
  } catch (e) {
    console.error("addWatchlistTicker failed", e);
    return { data: null, error: "Ticker konnte nicht hinzugefügt werden." };
  }
}

export async function updateWatchlistTicker(
  id: string,
  patch: Partial<Pick<DailyReviewWatchlistRow, "taken" | "note" | "ticker">>
): Promise<{ error: string | null }> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("daily_review_watchlist").update(patch).eq("id", id);
    if (error) {
      console.error("updateWatchlistTicker failed", error);
      return { error: "Änderung konnte nicht gespeichert werden." };
    }
    return { error: null };
  } catch (e) {
    console.error("updateWatchlistTicker failed", e);
    return { error: "Änderung konnte nicht gespeichert werden." };
  }
}

export async function removeWatchlistTicker(id: string): Promise<{ error: string | null }> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("daily_review_watchlist").delete().eq("id", id);
    if (error) {
      console.error("removeWatchlistTicker failed", error);
      return { error: "Ticker konnte nicht entfernt werden." };
    }
    return { error: null };
  } catch (e) {
    console.error("removeWatchlistTicker failed", e);
    return { error: "Ticker konnte nicht entfernt werden." };
  }
}

export async function addTradeCard(
  reviewId: string
): Promise<{ data: DailyReviewTradeRow; error: null } | { data: null; error: string }> {
  try {
    const supabase = getSupabaseAdmin();
    const { data: lastRow } = await supabase
      .from("daily_review_trades")
      .select("sort_order")
      .eq("review_id", reviewId)
      .order("sort_order", { ascending: false })
      .limit(1);
    const nextSortOrder = lastRow && lastRow.length > 0 ? (lastRow[0].sort_order as number) + 1 : 0;

    const { data, error } = await supabase
      .from("daily_review_trades")
      .insert({ review_id: reviewId, ticker: "", sort_order: nextSortOrder })
      .select("*")
      .single();

    if (error || !data) {
      console.error("addTradeCard failed", error);
      return { data: null, error: "Trade-Karte konnte nicht hinzugefügt werden." };
    }
    return { data: data as DailyReviewTradeRow, error: null };
  } catch (e) {
    console.error("addTradeCard failed", e);
    return { data: null, error: "Trade-Karte konnte nicht hinzugefügt werden." };
  }
}

export async function updateTradeCard(
  id: string,
  patch: Partial<
    Pick<
      DailyReviewTradeRow,
      "ticker" | "setup" | "trigger_tactic" | "stop_logic" | "what_happened" | "management" | "stop_now" | "my_thinking"
    >
  >
): Promise<{ error: string | null }> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("daily_review_trades").update(patch).eq("id", id);
    if (error) {
      console.error("updateTradeCard failed", error);
      return { error: "Änderung konnte nicht gespeichert werden." };
    }
    return { error: null };
  } catch (e) {
    console.error("updateTradeCard failed", e);
    return { error: "Änderung konnte nicht gespeichert werden." };
  }
}

export async function removeTradeCard(id: string): Promise<{ error: string | null }> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("daily_review_trades").delete().eq("id", id);
    if (error) {
      console.error("removeTradeCard failed", error);
      return { error: "Trade-Karte konnte nicht entfernt werden." };
    }
    return { error: null };
  } catch (e) {
    console.error("removeTradeCard failed", e);
    return { error: "Trade-Karte konnte nicht entfernt werden." };
  }
}

/** Sets a guardrail's state (upsert on the unique(review_id, guardrail_key) pair). There is no "unclicked" state to write — that's the absence of a row, see clearGuardrailStatus. */
export async function setGuardrailStatus(
  reviewId: string,
  guardrailKey: string,
  status: DailyReviewGuardrailStatus,
  note: string | null
): Promise<{ error: string | null }> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("daily_review_guardrails")
      .upsert({ review_id: reviewId, guardrail_key: guardrailKey, status, note }, { onConflict: "review_id,guardrail_key" });
    if (error) {
      console.error("setGuardrailStatus failed", error);
      return { error: "Guardrail konnte nicht gespeichert werden." };
    }
    return { error: null };
  } catch (e) {
    console.error("setGuardrailStatus failed", e);
    return { error: "Guardrail konnte nicht gespeichert werden." };
  }
}

/** Removes a guardrail's row entirely — back to the default "not clicked" state, which is empty, not "held". */
export async function clearGuardrailStatus(reviewId: string, guardrailKey: string): Promise<{ error: string | null }> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("daily_review_guardrails")
      .delete()
      .eq("review_id", reviewId)
      .eq("guardrail_key", guardrailKey);
    if (error) {
      console.error("clearGuardrailStatus failed", error);
      return { error: "Guardrail konnte nicht zurückgesetzt werden." };
    }
    return { error: null };
  } catch (e) {
    console.error("clearGuardrailStatus failed", e);
    return { error: "Guardrail konnte nicht zurückgesetzt werden." };
  }
}

export type TradeAutocompleteField = "setup" | "trigger_tactic" | "stop_logic";

/** Distinct historical values of one trade-card field, across all reviews — the "autocomplete aus der eigenen Historie" that replaces every Setup/Trigger/Stop-Logic dropdown. */
export async function getFieldSuggestions(field: TradeAutocompleteField): Promise<string[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("daily_review_trades").select(field).not(field, "is", null);
    if (error) {
      console.error("getFieldSuggestions failed", error);
      return [];
    }
    const values = new Set<string>();
    for (const row of data ?? []) {
      const value = (row as Record<string, unknown>)[field];
      if (typeof value === "string" && value.trim() !== "") values.add(value.trim());
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b, "de"));
  } catch (e) {
    console.error("getFieldSuggestions failed", e);
    return [];
  }
}

function formatGermanDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}.${month}.${year}`;
}

function plainNumber(value: number | null): string {
  return value === null ? "" : String(value);
}

/**
 * §5 (v2.1) — the Markdown export ("Für Claude kopieren"), the most
 * important output of the whole page. Fixed section order, empty
 * fields/sections omitted entirely (not rendered as "—"), no
 * interpretation or summarization — a pure passthrough of whatever was
 * captured. A review exported in the morning (Kopf + Block 2 only) is
 * a valid, useful partial export, not an error state.
 */
export function buildMarkdownExport(data: DailyReviewData): string {
  const { review, watchlist, trades, guardrails } = data;
  const lines: string[] = [`# Daily Review — ${formatGermanDate(review.trade_date)}`];

  const kopfLines: string[] = [];
  if (review.risk_pct !== null) kopfLines.push(`- Risk: ${plainNumber(review.risk_pct)} %`);
  if (review.r_value_usd !== null) kopfLines.push(`- 1R: ${plainNumber(review.r_value_usd)} USD`);
  if (review.nlv_close !== null) kopfLines.push(`- NLV Close: ${plainNumber(review.nlv_close)} USD`);
  if (watchlist.length > 0) kopfLines.push(`- Watchlist: ${watchlist.map((w) => w.ticker).join(", ")}`);
  const takenTickers = watchlist.filter((w) => w.taken);
  if (takenTickers.length > 0) kopfLines.push(`- Genommen: ${takenTickers.map((w) => w.ticker).join(", ")}`);
  if (kopfLines.length > 0) lines.push("## Kopf", ...kopfLines);

  const planLines: string[] = [];
  if (review.session_plan) planLines.push(review.session_plan);
  if (review.opportunity_spike) planLines.push(`- Opportunity Spike: ${review.opportunity_spike}`);
  if (planLines.length > 0) lines.push("## Plan & Gedankengänge für die heutige Session", ...planLines);

  if (review.market_context) lines.push("## Marktumgebung", review.market_context);

  const personalLines: string[] = [];
  if (review.personal_state) personalLines.push(review.personal_state);
  if (review.focus_level !== null) personalLines.push(`Fokus: ${plainNumber(review.focus_level)}/5`);
  if (personalLines.length > 0) lines.push("## Persönliche Lage / Mentales", ...personalLines);

  const tradesWithTicker = trades.filter((t) => t.ticker.trim() !== "");
  if (tradesWithTicker.length > 0) {
    lines.push("## Trades");
    for (const t of tradesWithTicker) {
      lines.push(`### ${t.ticker}`);
      if (t.setup) lines.push(`- Setup: ${t.setup}`);
      if (t.trigger_tactic) lines.push(`- Trigger / Taktik: ${t.trigger_tactic}`);
      if (t.stop_logic) lines.push(`- Stop-Logik: ${t.stop_logic}`);
      if (t.what_happened) lines.push(`- Verlauf: ${t.what_happened}`);
      if (t.management) lines.push(`- Management heute: ${t.management}`);
      if (t.stop_now) lines.push(`- Stop jetzt: ${t.stop_now}`);
      if (t.my_thinking) lines.push(`- Meine Denke: ${t.my_thinking}`);
    }
  }

  const fazitLines: string[] = [];
  if (review.what_went_well) fazitLines.push(`**Gut:** ${review.what_went_well}`);
  if (review.what_went_wrong) fazitLines.push(`**Nicht gut:** ${review.what_went_wrong}`);
  if (review.what_to_improve) fazitLines.push(`**Besser:** ${review.what_to_improve}`);
  if (review.self_grade) fazitLines.push(`**Self Grade:** ${review.self_grade}`);
  if (fazitLines.length > 0) lines.push("## Fazit", ...fazitLines);

  const guardrailLines = guardrails.map((g) => {
    const label = DAILY_REVIEW_GUARDRAILS.find((d) => d.key === g.guardrail_key)?.label ?? g.guardrail_key;
    const statusLabel = GUARDRAIL_STATUS_LABELS[g.status];
    const noteSuffix = g.note ? ` — ${g.note}` : "";
    return `- ${label}: ${statusLabel}${noteSuffix}`;
  });
  if (guardrailLines.length > 0 || review.guardrails_note) {
    lines.push("## Guardrails", ...guardrailLines);
    if (review.guardrails_note) lines.push(review.guardrails_note);
  }

  return lines.join("\n");
}
