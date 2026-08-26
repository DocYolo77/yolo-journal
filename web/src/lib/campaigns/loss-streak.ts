// Loss-streak auto-counter (commitments.loss_state_auto_counter), built
// exactly to the user's own rule set (2026-08):
//
// - A "loss" only counts when an opened campaign is FULLY closed (every
//   bought share sold) with a net realized $ loss beyond the breakeven
//   band — a losing partial exit that the campaign later recovers from
//   does NOT count, only the campaign's final net outcome does.
// - A net PnL within +/- BREAKEVEN_BAND_USD counts as breakeven, not a
//   loss and not a win.
// - The streak resets to 0 on: two consecutive breakeven full-closes, OR
//   any profitable partial exit (a non-final SELL fill with a realized
//   gain beyond the breakeven band), OR any full-close win.
//
// Reuses lib/campaigns/realized-pnl.ts's commission-inclusive cash-flow
// convention (commission stored negative-as-cost) rather than
// reimplementing it, so full-close classification here always agrees
// with the same math already used for Weekly Review / MTD-auto.

import type { CampaignFill } from "./realized-pnl";
import { computeCampaignRealizedPnl } from "./realized-pnl";

/** Breakeven band in USD, applied symmetrically around $0 net P&L. */
const BREAKEVEN_BAND_USD = 5;

export type FillPnlEvent = {
  executed_at: string;
  /** Realized $ P&L of this one SELL fill against the running average cost basis (commission-inclusive). */
  realized_pnl: number;
  /** True if this SELL fill brings the campaign's running open quantity to zero (a full close). */
  is_full_close: boolean;
};

/**
 * Walks a campaign's fills chronologically with a running average-cost
 * basis, emitting one event per SELL fill. Needed (beyond the existing
 * whole-campaign net computation) to detect a profitable partial exit
 * that happens WHILE a campaign is still open — computeCampaignRealizedPnl
 * only nets already-closed campaigns, so it can't see that.
 */
export function computeFillPnlEvents(fills: CampaignFill[]): FillPnlEvent[] {
  const sorted = [...fills].sort((a, b) => a.executed_at.localeCompare(b.executed_at));
  const events: FillPnlEvent[] = [];

  let remainingQty = 0;
  let avgCost = 0;

  for (const f of sorted) {
    if (f.price === null) continue;
    const commission = f.commission ?? 0;

    if (f.side === "BUY") {
      // commission is stored negative-as-cost, so subtracting it adds cost.
      const buyCost = f.price * f.quantity - commission;
      const newQty = remainingQty + f.quantity;
      avgCost = newQty > 0 ? (avgCost * remainingQty + buyCost) / newQty : 0;
      remainingQty = newQty;
      continue;
    }

    // SELL — realize P&L for this fill against the running average cost.
    const proceeds = f.price * f.quantity + commission;
    const costBasis = avgCost * f.quantity;
    remainingQty -= f.quantity;

    events.push({
      executed_at: f.executed_at,
      realized_pnl: proceeds - costBasis,
      is_full_close: remainingQty <= 1e-6,
    });
  }

  return events;
}

function classifyPnl(pnl: number): "loss" | "win" | "breakeven" {
  if (Math.abs(pnl) <= BREAKEVEN_BAND_USD) return "breakeven";
  return pnl < 0 ? "loss" : "win";
}

type TimelineEvent =
  | { kind: "campaign_closed"; at: string; classification: "loss" | "win" | "breakeven" }
  | { kind: "partial_win"; at: string };

/**
 * Chronological state machine over every campaign's fills, per the rules
 * above. `campaigns` should include every campaign up to the trade date
 * being synced (open and closed) — open campaigns are only consulted for
 * their profitable-partial-exit reset events, closed ones for their
 * final win/loss/breakeven classification.
 */
export function computeLossStreakCounter(
  campaigns: { id: string; status: string; ended_at: string | null }[],
  fillsByCampaignId: Map<string, CampaignFill[]>
): number {
  const events: TimelineEvent[] = [];

  for (const c of campaigns) {
    const fills = fillsByCampaignId.get(c.id) ?? [];
    if (fills.length === 0) continue;

    if (c.status === "closed") {
      const pnl = computeCampaignRealizedPnl(fills);
      if (pnl !== null) {
        const at = c.ended_at ?? fills[fills.length - 1].executed_at;
        events.push({ kind: "campaign_closed", at, classification: classifyPnl(pnl) });
      }
    }

    for (const fillEvent of computeFillPnlEvents(fills)) {
      if (!fillEvent.is_full_close && fillEvent.realized_pnl > BREAKEVEN_BAND_USD) {
        events.push({ kind: "partial_win", at: fillEvent.executed_at });
      }
    }
  }

  events.sort((a, b) => a.at.localeCompare(b.at));

  let counter = 0;
  let breakevenStreak = 0;

  for (const event of events) {
    if (event.kind === "partial_win") {
      counter = 0;
      breakevenStreak = 0;
      continue;
    }

    if (event.classification === "loss") {
      counter += 1;
      breakevenStreak = 0;
    } else if (event.classification === "win") {
      counter = 0;
      breakevenStreak = 0;
    } else {
      breakevenStreak += 1;
      if (breakevenStreak >= 2) {
        counter = 0;
        breakevenStreak = 0;
      }
    }
  }

  return counter;
}
