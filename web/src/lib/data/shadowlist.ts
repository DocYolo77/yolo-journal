import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { ShadowlistDecisionRow } from "@/lib/supabase/types";
import type { CommitmentWithChildren } from "@/lib/data/commitments";

/**
 * Returns the shadowlist decision rows for a locked commitment, seeding
 * one row per committed-watchlist ticker on first access so nothing has
 * to be re-typed by hand. Idempotent: re-running with existing rows is a
 * no-op for tickers that already have a decision.
 *
 * IBKR auto-force ("if the ticker was actually traded, force
 * actually_traded=true / decision=Genommen" — §6.1) is intentionally not
 * wired up yet: there is no broker execution data source in this
 * environment to check against. Once broker_executions exists and is
 * populated, this function is the place to apply that override before
 * returning.
 */
export async function getOrCreateShadowlistDecisions(
  commitment: CommitmentWithChildren
): Promise<{ data: ShadowlistDecisionRow[]; error: null } | { data: null; error: string }> {
  try {
    const supabase = getSupabaseAdmin();

    const { data: existing, error: existingError } = await supabase
      .from("shadowlist_decisions")
      .select("*")
      .eq("commitment_id", commitment.id);

    if (existingError) {
      console.error("getOrCreateShadowlistDecisions: read failed", existingError);
      return { data: null, error: "Shadowlist konnte nicht geladen werden." };
    }

    const existingTickers = new Set((existing ?? []).map((row) => row.ticker));
    const missing = commitment.watchlist.filter((item) => !existingTickers.has(item.ticker));

    let seeded: ShadowlistDecisionRow[] = [];

    if (missing.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from("shadowlist_decisions")
        .insert(
          missing.map((item) => ({
            commitment_id: commitment.id,
            trade_date: commitment.trade_date,
            ticker: item.ticker,
            list_type: item.list_type,
          }))
        )
        .select("*");

      if (insertError) {
        console.error("getOrCreateShadowlistDecisions: seed failed", insertError);
        return { data: null, error: "Shadowlist konnte nicht angelegt werden." };
      }

      seeded = inserted ?? [];
    }

    const all = [...(existing ?? []), ...seeded];
    const orderByTicker = new Map(commitment.watchlist.map((item, index) => [item.ticker, index]));
    all.sort((a, b) => (orderByTicker.get(a.ticker) ?? 0) - (orderByTicker.get(b.ticker) ?? 0));

    return { data: all, error: null };
  } catch (e) {
    console.error("getOrCreateShadowlistDecisions failed", e);
    return { data: null, error: "Shadowlist konnte nicht geladen werden." };
  }
}

export type ShadowlistSummary = {
  committedSlots: number;
  primeSlots: number;
  genommen: number;
  shadow: number;
  takeRatePct: number | null;
};

export function computeShadowlistSummary(decisions: ShadowlistDecisionRow[]): ShadowlistSummary {
  const committedSlots = decisions.length;
  const primeSlots = decisions.filter((d) => d.list_type === "Prime").length;
  const genommen = decisions.filter((d) => d.decision === "Genommen").length;
  const shadow = committedSlots - genommen;
  const takeRatePct = committedSlots > 0 ? (genommen / committedSlots) * 100 : null;

  return { committedSlots, primeSlots, genommen, shadow, takeRatePct };
}
