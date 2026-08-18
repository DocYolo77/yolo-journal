// Shared realized-$-P&L math and fill-fetching for closed campaigns —
// used by both the Weekly Review aggregation (lib/weekly-review/compute.ts
// + fetch.ts) and the MTD auto-computation step in lib/broker/ibkr-sync.ts.
// Kept here so the commission-inclusive cash-flow netting formula has one
// definition instead of drifting between the two call sites.

import type { getSupabaseAdmin } from "@/lib/supabase/server";
import type { CampaignRow } from "@/lib/supabase/types";

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

export type CampaignFill = {
  side: "BUY" | "SELL";
  price: number | null;
  quantity: number;
  commission: number | null;
  executed_at: string;
};

/** Nets a closed campaign's fills to a realized $ P&L (commission-inclusive). Null if any fill lacks a price. */
export function computeCampaignRealizedPnl(fills: CampaignFill[]): number | null {
  if (fills.length === 0) return null;
  let cash = 0;
  for (const f of fills) {
    if (f.price === null) return null;
    cash += f.side === "SELL" ? f.price * f.quantity : -f.price * f.quantity;
    cash += f.commission ?? 0;
  }
  return cash;
}

/** campaign_id -> its linked fills, ascending by executed_at. */
export async function fetchFillsForCampaigns(
  supabase: SupabaseAdminClient,
  campaigns: Pick<CampaignRow, "id">[]
): Promise<Map<string, CampaignFill[]>> {
  const result = new Map<string, CampaignFill[]>();
  if (campaigns.length === 0) return result;

  const campaignIds = campaigns.map((c) => c.id);
  const { data: links } = await supabase
    .from("campaign_executions")
    .select("campaign_id, broker_execution_id")
    .in("campaign_id", campaignIds);

  const executionIds = (links ?? []).map((l) => l.broker_execution_id as string);
  if (executionIds.length === 0) return result;

  const { data: executions } = await supabase
    .from("broker_executions")
    .select("id, side, price, quantity, commission, executed_at")
    .in("id", executionIds);

  const executionById = new Map((executions ?? []).map((e) => [e.id as string, e]));

  for (const link of links ?? []) {
    const execution = executionById.get(link.broker_execution_id as string);
    if (!execution) continue;
    const campaignId = link.campaign_id as string;
    if (!result.has(campaignId)) result.set(campaignId, []);
    result.get(campaignId)!.push({
      side: execution.side as "BUY" | "SELL",
      price: (execution.price as number | null) ?? null,
      quantity: Number(execution.quantity),
      commission: (execution.commission as number | null) ?? null,
      executed_at: execution.executed_at as string,
    });
  }

  for (const fills of result.values()) {
    fills.sort((a, b) => a.executed_at.localeCompare(b.executed_at));
  }

  return result;
}

/** Sum of realized $ P&L across all closed campaigns in `campaigns`, using `fillsByCampaignId`. */
export function sumClosedCampaignRealizedPnl(
  campaigns: { id: string; status: string }[],
  fillsByCampaignId: Map<string, CampaignFill[]>
): number {
  return campaigns
    .filter((c) => c.status === "closed")
    .reduce((total, c) => {
      const pnl = computeCampaignRealizedPnl(fillsByCampaignId.get(c.id) ?? []);
      return pnl !== null ? total + pnl : total;
    }, 0);
}
