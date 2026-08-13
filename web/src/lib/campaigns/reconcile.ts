// Campaign reconciliation — groups broker_executions (raw fills) into
// campaigns (the journal/process unit), per
// JOURNAL_OS_DATA_INTEGRATION_ARCHITECTURE.md §9 ("Ticker statt Klicks
// zählen"). Pure functions — no I/O, no Supabase dependency — so they're
// testable with fixture data and safe to run inside the scheduled IBKR
// agent sync (see docs/ibkr-agent-sync-runbook.md) without any DB access
// of their own.

export type CampaignDirection = "long" | "short";

export type OpenCampaignState = {
  campaignId: string;
  symbol: string;
  direction: CampaignDirection;
  /** Always a positive magnitude — sign is carried by `direction`. */
  netQuantity: number;
};

export type ReconcileFill = {
  executionId: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  executedAt: string;
};

/**
 * `campaignId` on `open_campaign` (and on subsequent actions that
 * reference a campaign opened earlier in the same call) is a
 * batch-local placeholder of the form `new-campaign-<n>`, not a real
 * database id — no row exists yet. The caller must insert campaigns in
 * action order and substitute each placeholder with the real inserted
 * uuid before writing dependent `campaign_executions` rows.
 */
export type ReconcileAction =
  | {
      type: "open_campaign";
      campaignId: string;
      symbol: string;
      direction: CampaignDirection;
      startedAt: string;
      executionId: string;
      source: "reconstructed";
    }
  | { type: "attach_to_open"; campaignId: string; executionId: string }
  | { type: "close_campaign"; campaignId: string; executionId: string; endedAt: string }
  | {
      // A fill that would carry the position through zero to the
      // opposite side. campaign_executions.broker_execution_id is
      // unique, so a single fill can never be split across the closing
      // campaign and a new opposite-direction one — this closes the
      // existing campaign with the fill and reports the overshoot
      // instead of guessing a new campaign into existence.
      type: "flag_reversal";
      campaignId: string;
      executionId: string;
      endedAt: string;
      overshootDirection: CampaignDirection;
      overshootQuantity: number;
    };

/**
 * Reconciles a chronologically-ordered batch of new fills for a SINGLE
 * symbol against that symbol's currently open campaign (if any).
 *
 * Caller is responsible for: grouping fills by symbol, sorting each
 * symbol's fills ascending by `executedAt`, and loading the current
 * `OpenCampaignState` (or null) for that symbol before calling this.
 */
export function reconcileCampaignFills(
  fills: ReconcileFill[],
  openCampaign: OpenCampaignState | null
): ReconcileAction[] {
  const actions: ReconcileAction[] = [];
  let current = openCampaign;
  let newCampaignCounter = 0;

  for (const fill of fills) {
    const signedDelta = fill.side === "BUY" ? fill.quantity : -fill.quantity;

    if (!current) {
      const direction: CampaignDirection = fill.side === "BUY" ? "long" : "short";
      const campaignId = `new-campaign-${newCampaignCounter++}`;
      actions.push({
        type: "open_campaign",
        campaignId,
        symbol: fill.symbol,
        direction,
        startedAt: fill.executedAt,
        executionId: fill.executionId,
        source: "reconstructed",
      });
      current = { campaignId, symbol: fill.symbol, direction, netQuantity: fill.quantity };
      continue;
    }

    const currentSigned = current.direction === "long" ? current.netQuantity : -current.netQuantity;
    const newSigned = currentSigned + signedDelta;

    if (newSigned === 0) {
      actions.push({
        type: "close_campaign",
        campaignId: current.campaignId,
        executionId: fill.executionId,
        endedAt: fill.executedAt,
      });
      current = null;
      continue;
    }

    const crossedZero = Math.sign(newSigned) !== Math.sign(currentSigned);
    if (crossedZero) {
      actions.push({
        type: "flag_reversal",
        campaignId: current.campaignId,
        executionId: fill.executionId,
        endedAt: fill.executedAt,
        overshootDirection: newSigned > 0 ? "long" : "short",
        overshootQuantity: Math.abs(newSigned),
      });
      // The overshoot is never auto-opened into a new campaign — needs
      // a human to confirm and create it, same as a prior-position gap.
      current = null;
      continue;
    }

    actions.push({ type: "attach_to_open", campaignId: current.campaignId, executionId: fill.executionId });
    current = { ...current, netQuantity: Math.abs(newSigned) };
  }

  return actions;
}

export type LivePositionForReconciliation = {
  symbol: string;
  /** Signed: positive = long, negative = short. */
  quantity: number;
};

export type UnresolvedPriorPosition = {
  symbol: string;
  quantity: number;
  direction: CampaignDirection;
};

/**
 * After fill reconciliation, a symbol may show a nonzero live broker
 * position (from broker_positions_snapshots) with no open campaign left
 * to explain it — e.g. a position that pre-dates this journal's fill
 * history, or a gap in synced executions. Never auto-resolved into a
 * guessed campaign (architecture doc §9): reported so a human can create
 * a `source = 'prior_position_unresolved'` campaign with whatever real
 * entry information they have.
 */
export function findUnresolvedPriorPositions(
  livePositions: LivePositionForReconciliation[],
  openCampaignSymbols: ReadonlySet<string>
): UnresolvedPriorPosition[] {
  return livePositions
    .filter((position) => position.quantity !== 0 && !openCampaignSymbols.has(position.symbol))
    .map((position) => ({
      symbol: position.symbol,
      quantity: Math.abs(position.quantity),
      direction: position.quantity > 0 ? "long" : "short",
    }));
}
