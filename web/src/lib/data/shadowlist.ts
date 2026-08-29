import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { ShadowlistDecisionRow } from "@/lib/supabase/types";
import type { CommitmentWithChildren } from "@/lib/data/commitments";
import { appendAuditEvent } from "@/lib/audit";

/**
 * Returns the shadowlist decision rows for a locked commitment, seeding
 * one row per committed-watchlist ticker on first access so nothing has
 * to be re-typed by hand, then applying the IBKR auto-override (§6.1)
 * before returning. Idempotent: re-running with existing rows is a no-op
 * for tickers that already have a decision and are already marked
 * traded.
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

    const overridden = await applyIbkrAutoOverride(commitment, all);
    if (!overridden.data) {
      return overridden;
    }

    return { data: overridden.data, error: null };
  } catch (e) {
    console.error("getOrCreateShadowlistDecisions failed", e);
    return { data: null, error: "Shadowlist konnte nicht geladen werden." };
  }
}

/**
 * IBKR auto-force (§6.1): if a `campaigns` row exists for a committed
 * ticker on this trade_date — i.e. the broker sync reconciled at least
 * one real fill into a campaign for it — the ticker was actually traded
 * regardless of what the shadowlist decision currently says, and the
 * decision is force-corrected to actually_traded=true /
 * decision='Genommen'. Checking `campaigns` (not raw `broker_executions`)
 * deliberately follows "Ticker statt Klicks zählen" — the economic
 * grouping is the source of truth, not individual fills.
 *
 * Every actual correction is written to the audit_events ledger via
 * `shadowlist_auto_overridden`, including whether the row already carried
 * a human-entered decision/reason/notes at the time
 * (`had_prior_manual_input`), so a case where the trader explicitly
 * logged "not taken" but the broker disagrees is never silently lost.
 * If the audit write fails after the row update succeeded, this reports
 * an error rather than treating the override as silently complete — a
 * partial failure here must never look like success.
 */
async function applyIbkrAutoOverride(
  commitment: CommitmentWithChildren,
  decisions: ShadowlistDecisionRow[]
): Promise<{ data: ShadowlistDecisionRow[]; error: null } | { data: null; error: string }> {
  if (decisions.length === 0) {
    return { data: decisions, error: null };
  }

  const supabase = getSupabaseAdmin();
  const tickers = decisions.map((d) => d.ticker);

  const { data: tradedCampaigns, error: campaignsError } = await supabase
    .from("campaigns")
    .select("symbol")
    .eq("trade_date", commitment.trade_date)
    .in("symbol", tickers);

  if (campaignsError) {
    console.error("applyIbkrAutoOverride: campaign lookup failed", campaignsError);
    return { data: null, error: "Shadowlist-Abgleich mit Broker-Daten fehlgeschlagen." };
  }

  const tradedTickers = new Set((tradedCampaigns ?? []).map((c) => c.symbol as string));
  if (tradedTickers.size === 0) {
    return { data: decisions, error: null };
  }

  const result: ShadowlistDecisionRow[] = [];

  for (const decision of decisions) {
    const alreadyCorrect = decision.actually_traded && decision.decision === "Genommen";
    if (!tradedTickers.has(decision.ticker) || alreadyCorrect) {
      result.push(decision);
      continue;
    }

    const hadPriorManualInput =
      decision.decision === "Genommen" || decision.reason !== null || decision.notes !== null;

    const { data: updated, error: updateError } = await supabase
      .from("shadowlist_decisions")
      .update({ actually_traded: true, decision: "Genommen" })
      .eq("id", decision.id)
      .select("*")
      .single();

    if (updateError || !updated) {
      console.error("applyIbkrAutoOverride: update failed", updateError);
      return { data: null, error: "Shadowlist-Auto-Override konnte nicht gespeichert werden." };
    }

    const { error: auditError } = await appendAuditEvent({
      eventType: "shadowlist_auto_overridden",
      tradeDate: commitment.trade_date,
      entityType: "shadowlist_decision",
      entityId: decision.id,
      actor: "ibkr_sync",
      payload: {
        ticker: decision.ticker,
        commitment_id: commitment.id,
        previous_actually_traded: decision.actually_traded,
        previous_decision: decision.decision,
        previous_reason: decision.reason,
        had_prior_manual_input: hadPriorManualInput,
      },
    });

    if (auditError) {
      console.error("applyIbkrAutoOverride: audit event failed", auditError);
      return {
        data: null,
        error: `Shadowlist wurde aktualisiert, aber das Audit-Event konnte nicht gespeichert werden: ${auditError}`,
      };
    }

    result.push(updated);
  }

  return { data: result, error: null };
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
