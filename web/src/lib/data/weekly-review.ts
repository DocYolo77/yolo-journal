import { getSupabaseAdmin } from "@/lib/supabase/server";
import type {
  WeeklyReviewDemonRow,
  WeeklyReviewMissedRow,
  WeeklyReviewRow,
  WeeklyReviewTradeRow,
} from "@/lib/supabase/types";
import { getIsoWeek } from "@/lib/trade-date";
import { WEEKLY_DEMON_ITEMS, WEEKLY_HANDOVER_MARKDOWN } from "@/lib/validation/weekly-review";

// Weekly Review v2 data layer — a pure capture tool, same shape as
// lib/data/daily-review.ts. Every function here stores or retrieves
// inputs; none of them judge, enforce, or compute. See CLAUDE.md's
// "Weekly Review v2" section for the product rationale.

const POSTGRES_UNIQUE_VIOLATION = "23505";

export type WeeklyReviewData = {
  review: WeeklyReviewRow;
  trades: WeeklyReviewTradeRow[];
  missed: WeeklyReviewMissedRow[];
  demons: WeeklyReviewDemonRow[];
};

/**
 * Gets the weekly_reviews row for the Monday-Friday week containing
 * weekStart, creating an empty one if it doesn't exist yet. Keyed on
 * (iso_year, iso_week) — idempotent under concurrent calls via a
 * unique-violation retry, same pattern as getOrCreateDailyReview.
 */
export async function getOrCreateWeeklyReview(
  weekStart: string,
  weekEnd: string
): Promise<{ data: WeeklyReviewRow; error: null } | { data: null; error: string }> {
  const { isoYear, isoWeek } = getIsoWeek(weekStart);

  try {
    const supabase = getSupabaseAdmin();

    const { data: existing, error: selectError } = await supabase
      .from("weekly_reviews")
      .select("*")
      .eq("iso_year", isoYear)
      .eq("iso_week", isoWeek)
      .maybeSingle();

    if (selectError) {
      console.error("getOrCreateWeeklyReview: select failed", selectError);
      return { data: null, error: "Weekly Review konnte nicht geladen werden." };
    }
    if (existing) {
      return { data: existing as WeeklyReviewRow, error: null };
    }

    const { data: inserted, error: insertError } = await supabase
      .from("weekly_reviews")
      .insert({ iso_year: isoYear, iso_week: isoWeek, week_start: weekStart, week_end: weekEnd })
      .select("*")
      .single();

    if (insertError) {
      if (insertError.code === POSTGRES_UNIQUE_VIOLATION) {
        const { data: retried, error: retryError } = await supabase
          .from("weekly_reviews")
          .select("*")
          .eq("iso_year", isoYear)
          .eq("iso_week", isoWeek)
          .single();
        if (retryError || !retried) {
          console.error("getOrCreateWeeklyReview: retry-after-conflict failed", retryError);
          return { data: null, error: "Weekly Review konnte nicht geladen werden." };
        }
        return { data: retried as WeeklyReviewRow, error: null };
      }
      console.error("getOrCreateWeeklyReview: insert failed", insertError);
      return { data: null, error: "Weekly Review konnte nicht angelegt werden." };
    }

    return { data: inserted as WeeklyReviewRow, error: null };
  } catch (e) {
    console.error("getOrCreateWeeklyReview failed", e);
    return { data: null, error: "Weekly Review konnte nicht geladen werden." };
  }
}

export async function getWeeklyReviewData(
  weekStart: string,
  weekEnd: string
): Promise<{ data: WeeklyReviewData; error: null } | { data: null; error: string }> {
  const reviewResult = await getOrCreateWeeklyReview(weekStart, weekEnd);
  if (reviewResult.error || !reviewResult.data) {
    return { data: null, error: reviewResult.error ?? "Weekly Review konnte nicht geladen werden." };
  }
  const review = reviewResult.data;

  try {
    const supabase = getSupabaseAdmin();

    const [{ data: trades }, { data: missed }, { data: demons }] = await Promise.all([
      supabase.from("weekly_review_trades").select("*").eq("review_id", review.id).order("sort_order"),
      supabase.from("weekly_review_missed").select("*").eq("review_id", review.id).order("sort_order"),
      supabase.from("weekly_review_demons").select("*").eq("review_id", review.id),
    ]);

    return {
      data: {
        review,
        trades: (trades ?? []) as WeeklyReviewTradeRow[],
        missed: (missed ?? []) as WeeklyReviewMissedRow[],
        demons: (demons ?? []) as WeeklyReviewDemonRow[],
      },
      error: null,
    };
  } catch (e) {
    console.error("getWeeklyReviewData failed", e);
    return { data: null, error: "Weekly Review konnte nicht geladen werden." };
  }
}

export type WeeklyReviewFieldPatch = Partial<
  Pick<
    WeeklyReviewRow,
    | "brueche"
    | "regime"
    | "bias_flip"
    | "bias_flip_text"
    | "leadership"
    | "satz_der_woche"
    | "mental_tags"
    | "fokus"
    | "mental_text"
    | "staerkste_namen"
    | "gehandelt"
    | "nicht_gehandelt"
    | "verpasst"
    | "guter_skip"
    | "gemeinsame_eigenschaften"
    | "worst_trade_ticker"
    | "worst_trade_text"
    | "wiederholung"
    | "wiederholung_text"
    | "good_trade_ticker"
    | "good_trade_text"
    | "rolle_stockpicker_ja_nein"
    | "rolle_stockpicker_text"
    | "rolle_allocator_ja_nein"
    | "rolle_allocator_text"
    | "rolle_operator_ja_nein"
    | "rolle_operator_text"
    | "self_grade"
    | "self_grade_begruendung"
    | "regel"
    | "regel_konkret"
    | "regel_pruefung"
    | "idea_capture"
  >
>;

/** Generic partial update of the flat weekly_reviews columns — the autosave target for every field outside the repeatable cards. */
export async function updateWeeklyReviewFields(reviewId: string, patch: WeeklyReviewFieldPatch): Promise<{ error: string | null }> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("weekly_reviews").update(patch).eq("id", reviewId);
    if (error) {
      console.error("updateWeeklyReviewFields failed", error);
      return { error: "Änderung konnte nicht gespeichert werden." };
    }
    return { error: null };
  } catch (e) {
    console.error("updateWeeklyReviewFields failed", e);
    return { error: "Änderung konnte nicht gespeichert werden." };
  }
}

export async function addWeeklyTradeCard(
  reviewId: string
): Promise<{ data: WeeklyReviewTradeRow; error: null } | { data: null; error: string }> {
  try {
    const supabase = getSupabaseAdmin();
    const { data: lastRow } = await supabase
      .from("weekly_review_trades")
      .select("sort_order")
      .eq("review_id", reviewId)
      .order("sort_order", { ascending: false })
      .limit(1);
    const nextSortOrder = lastRow && lastRow.length > 0 ? (lastRow[0].sort_order as number) + 1 : 0;

    const { data, error } = await supabase
      .from("weekly_review_trades")
      .insert({ review_id: reviewId, ticker: "", sort_order: nextSortOrder })
      .select("*")
      .single();

    if (error || !data) {
      console.error("addWeeklyTradeCard failed", error);
      return { data: null, error: "Trade-Karte konnte nicht hinzugefügt werden." };
    }
    return { data: data as WeeklyReviewTradeRow, error: null };
  } catch (e) {
    console.error("addWeeklyTradeCard failed", e);
    return { data: null, error: "Trade-Karte konnte nicht hinzugefügt werden." };
  }
}

export async function updateWeeklyTradeCard(
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
): Promise<{ error: string | null }> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("weekly_review_trades").update(patch).eq("id", id);
    if (error) {
      console.error("updateWeeklyTradeCard failed", error);
      return { error: "Änderung konnte nicht gespeichert werden." };
    }
    return { error: null };
  } catch (e) {
    console.error("updateWeeklyTradeCard failed", e);
    return { error: "Änderung konnte nicht gespeichert werden." };
  }
}

export async function removeWeeklyTradeCard(id: string): Promise<{ error: string | null }> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("weekly_review_trades").delete().eq("id", id);
    if (error) {
      console.error("removeWeeklyTradeCard failed", error);
      return { error: "Trade-Karte konnte nicht entfernt werden." };
    }
    return { error: null };
  } catch (e) {
    console.error("removeWeeklyTradeCard failed", e);
    return { error: "Trade-Karte konnte nicht entfernt werden." };
  }
}

export async function addMissedCard(
  reviewId: string
): Promise<{ data: WeeklyReviewMissedRow; error: null } | { data: null; error: string }> {
  try {
    const supabase = getSupabaseAdmin();
    const { data: lastRow } = await supabase
      .from("weekly_review_missed")
      .select("sort_order")
      .eq("review_id", reviewId)
      .order("sort_order", { ascending: false })
      .limit(1);
    const nextSortOrder = lastRow && lastRow.length > 0 ? (lastRow[0].sort_order as number) + 1 : 0;

    const { data, error } = await supabase
      .from("weekly_review_missed")
      .insert({ review_id: reviewId, ticker: "", sort_order: nextSortOrder })
      .select("*")
      .single();

    if (error || !data) {
      console.error("addMissedCard failed", error);
      return { data: null, error: "Karte konnte nicht hinzugefügt werden." };
    }
    return { data: data as WeeklyReviewMissedRow, error: null };
  } catch (e) {
    console.error("addMissedCard failed", e);
    return { data: null, error: "Karte konnte nicht hinzugefügt werden." };
  }
}

export async function updateMissedCard(
  id: string,
  patch: Partial<{ ticker: string; chart_url: string | null; text: string | null }>
): Promise<{ error: string | null }> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("weekly_review_missed").update(patch).eq("id", id);
    if (error) {
      console.error("updateMissedCard failed", error);
      return { error: "Änderung konnte nicht gespeichert werden." };
    }
    return { error: null };
  } catch (e) {
    console.error("updateMissedCard failed", e);
    return { error: "Änderung konnte nicht gespeichert werden." };
  }
}

export async function removeMissedCard(id: string): Promise<{ error: string | null }> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("weekly_review_missed").delete().eq("id", id);
    if (error) {
      console.error("removeMissedCard failed", error);
      return { error: "Karte konnte nicht entfernt werden." };
    }
    return { error: null };
  } catch (e) {
    console.error("removeMissedCard failed", e);
    return { error: "Karte konnte nicht entfernt werden." };
  }
}

/** Sets a Demon Finder row's state (upsert on the unique(review_id, demon_key) pair). Deletes the row instead once both aktiv and text go back to empty — default state is absent, not "false". */
export async function setDemonState(
  reviewId: string,
  demonKey: string,
  aktiv: boolean,
  text: string | null
): Promise<{ error: string | null }> {
  try {
    const supabase = getSupabaseAdmin();
    if (!aktiv && !text) {
      const { error } = await supabase
        .from("weekly_review_demons")
        .delete()
        .eq("review_id", reviewId)
        .eq("demon_key", demonKey);
      if (error) {
        console.error("setDemonState: delete failed", error);
        return { error: "Änderung konnte nicht gespeichert werden." };
      }
      return { error: null };
    }

    const { error } = await supabase
      .from("weekly_review_demons")
      .upsert({ review_id: reviewId, demon_key: demonKey, aktiv, text }, { onConflict: "review_id,demon_key" });
    if (error) {
      console.error("setDemonState: upsert failed", error);
      return { error: "Änderung konnte nicht gespeichert werden." };
    }
    return { error: null };
  } catch (e) {
    console.error("setDemonState failed", e);
    return { error: "Änderung konnte nicht gespeichert werden." };
  }
}

/** Distinct historical tickers across Daily Review trades and past Weekly Review cards — the "Autocomplete aus der Historie" for every ticker field on this page. */
export async function getWeeklyTickerSuggestions(): Promise<string[]> {
  try {
    const supabase = getSupabaseAdmin();
    const [{ data: dailyTrades }, { data: weeklyTrades }, { data: missedCards }] = await Promise.all([
      supabase.from("daily_review_trades").select("ticker").not("ticker", "is", null),
      supabase.from("weekly_review_trades").select("ticker").not("ticker", "is", null),
      supabase.from("weekly_review_missed").select("ticker").not("ticker", "is", null),
    ]);

    const values = new Set<string>();
    for (const row of [...(dailyTrades ?? []), ...(weeklyTrades ?? []), ...(missedCards ?? [])]) {
      const ticker = (row as { ticker: string | null }).ticker;
      if (ticker && ticker.trim() !== "") values.add(ticker.trim());
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b, "de"));
  } catch (e) {
    console.error("getWeeklyTickerSuggestions failed", e);
    return [];
  }
}

function formatGermanDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}.${month}.${year}`;
}

const ROLE_LABELS = {
  stockpicker: "Stock Picker (Selektion/Watchlist)",
  allocator: "Allocator (welcher Name bekommt Slot und Size)",
  operator: "Operator (Execution/Management)",
} as const;

/**
 * §5 — the Markdown export ("Für Claude kopieren"). Fixed section order,
 * empty fields/sections omitted entirely, no interpretation or
 * summarization. Block 6 is a deliberate gap (Shadow Log — computed in
 * the LLM chat, not here) and never appears, not even as an empty
 * heading. Block 12 always appears, verbatim, even on an otherwise empty
 * week.
 */
export function buildWeeklyMarkdownExport(data: WeeklyReviewData): string {
  const { review, trades, missed, demons } = data;
  const { isoWeek: kw, isoYear: jahr } = { isoWeek: review.iso_week, isoYear: review.iso_year };
  const lines: string[] = [
    `# WEEKLY REVIEW — KW${kw} ${jahr} (${formatGermanDate(review.week_start)}–${formatGermanDate(review.week_end)})`,
  ];

  if (review.brueche) lines.push("## 1 · Zahlen & Guardrails", review.brueche);

  const marktLines: string[] = [];
  if (review.regime) marktLines.push(`- Regime: ${review.regime}`);
  if (review.bias_flip !== null) marktLines.push(`- Bias-Flip: ${review.bias_flip ? "Ja" : "Nein"}`);
  if (review.bias_flip_text) marktLines.push(`- Wann erkennbar: ${review.bias_flip_text}`);
  if (review.leadership) marktLines.push(`- Leadership: ${review.leadership}`);
  if (review.satz_der_woche) marktLines.push(`- Satz der Woche: ${review.satz_der_woche}`);
  if (marktLines.length > 0) lines.push("## 2 · Markt der Woche", ...marktLines);

  const mentalLines: string[] = [];
  if (review.mental_tags.length > 0) mentalLines.push(`- Tags: ${review.mental_tags.join(", ")}`);
  if (review.fokus !== null) mentalLines.push(`- Fokus: ${review.fokus}/5`);
  if (review.mental_text) mentalLines.push(review.mental_text);
  if (mentalLines.length > 0) lines.push("## 3 · Mentaler Zustand", ...mentalLines);

  const tradesWithTicker = trades.filter((t) => t.ticker.trim() !== "");
  if (tradesWithTicker.length > 0) {
    lines.push("## 4 · Trade-Karten");
    for (const t of tradesWithTicker) {
      lines.push(`### ${t.ticker}`);
      if (t.seite) lines.push(`- Seite: ${t.seite}`);
      if (t.setup) lines.push(`- Setup: ${t.setup}`);
      if (t.trigger_tactic) lines.push(`- Trigger: ${t.trigger_tactic}`);
      if (t.verlauf) lines.push(`- Verlauf: ${t.verlauf}`);
      if (t.grade_selektion) lines.push(`- Grade Selektion: ${t.grade_selektion}`);
      if (t.grade_entry) lines.push(`- Grade Entry: ${t.grade_entry}`);
      if (t.grade_management) lines.push(`- Grade Management: ${t.grade_management}`);
      if (t.prozess_vs_ergebnis) lines.push(`- Prozess vs. Ergebnis: ${t.prozess_vs_ergebnis}`);
      if (t.chart_url) lines.push(`- Chart: ${t.chart_url}`);
    }
  }

  const universumLines: string[] = [];
  if (review.staerkste_namen) universumLines.push(`- Stärkste Namen: ${review.staerkste_namen}`);
  if (review.gehandelt) universumLines.push(`- Gehandelt: ${review.gehandelt}`);
  if (review.nicht_gehandelt) universumLines.push(`- Nicht gehandelt: ${review.nicht_gehandelt}`);
  if (review.verpasst) universumLines.push(`- Verpasst: ${review.verpasst}`);
  if (review.guter_skip) universumLines.push(`- Guter Skip: ${review.guter_skip}`);
  if (universumLines.length > 0) lines.push("## 5 · Universum & Coverage", ...universumLines);

  // Block 6 — Shadow Log. Deliberate gap, never rendered.

  const missedWithTicker = missed.filter((m) => m.ticker.trim() !== "");
  const missedLines: string[] = [];
  for (const m of missedWithTicker) {
    missedLines.push(`### ${m.ticker}`);
    if (m.chart_url) missedLines.push(`- Chart: ${m.chart_url}`);
    if (m.text) missedLines.push(m.text);
  }
  if (missedLines.length > 0 || review.gemeinsame_eigenschaften) {
    lines.push("## 7 · Missed Reviews & A+ Pattern Recognition", ...missedLines);
    if (review.gemeinsame_eigenschaften) lines.push(`**Gemeinsame Eigenschaften:** ${review.gemeinsame_eigenschaften}`);
  }

  const demonLines: string[] = [];
  for (const item of WEEKLY_DEMON_ITEMS) {
    const row = demons.find((d) => d.demon_key === item.key);
    if (!row) continue;
    const suffix = row.text ? ` — ${row.text}` : "";
    demonLines.push(`- ${item.label}: ${row.aktiv ? "Ja" : "Nein"}${suffix}`);
  }
  if (review.worst_trade_ticker) demonLines.push(`- Worst Trade: ${review.worst_trade_ticker}`);
  if (review.worst_trade_text) demonLines.push(`- Was hätte stattdessen passieren müssen: ${review.worst_trade_text}`);
  if (review.wiederholung !== null) demonLines.push(`- Wiederholung: ${review.wiederholung ? "Ja" : "Nein"}`);
  if (review.wiederholung_text) demonLines.push(`- Seit wann / wie oft: ${review.wiederholung_text}`);
  if (demonLines.length > 0) lines.push("## 8 · Demon Finder", ...demonLines);

  const goodLines: string[] = [];
  if (review.good_trade_ticker) goodLines.push(`- Ticker: ${review.good_trade_ticker}`);
  if (review.good_trade_text) goodLines.push(review.good_trade_text);
  if (goodLines.length > 0) lines.push("## 9 · Bester Prozess der Woche", ...goodLines);

  const rollenLines: string[] = [];
  const roles: { key: keyof typeof ROLE_LABELS; jaNein: boolean | null; text: string | null }[] = [
    { key: "stockpicker", jaNein: review.rolle_stockpicker_ja_nein, text: review.rolle_stockpicker_text },
    { key: "allocator", jaNein: review.rolle_allocator_ja_nein, text: review.rolle_allocator_text },
    { key: "operator", jaNein: review.rolle_operator_ja_nein, text: review.rolle_operator_text },
  ];
  for (const role of roles) {
    if (role.jaNein === null && !role.text) continue;
    const jaNeinLabel = role.jaNein === null ? "" : role.jaNein ? "Ja" : "Nein";
    const suffix = role.text ? ` — ${role.text}` : "";
    rollenLines.push(`- ${ROLE_LABELS[role.key]}: ${jaNeinLabel}${suffix}`);
  }
  if (review.self_grade) rollenLines.push(`- Self Grade: ${review.self_grade}${review.self_grade_begruendung ? ` — ${review.self_grade_begruendung}` : ""}`);
  if (rollenLines.length > 0) lines.push("## 10 · Rollen-Check & Self-Grade", ...rollenLines);

  const regelLines: string[] = [];
  if (review.regel) regelLines.push(`- Regel: ${review.regel}`);
  if (review.regel_konkret) regelLines.push(`- Konkret: ${review.regel_konkret}`);
  if (review.regel_pruefung) regelLines.push(`- Prüfung: ${review.regel_pruefung}`);
  if (review.idea_capture) regelLines.push(`- Idea Capture: ${review.idea_capture}`);
  if (regelLines.length > 0) lines.push("## 11 · Die eine Regel für nächste Woche", ...regelLines);

  lines.push(WEEKLY_HANDOVER_MARKDOWN);

  return lines.join("\n");
}
