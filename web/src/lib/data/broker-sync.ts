import { getSupabaseAdmin } from "@/lib/supabase/server";

export type LatestSyncRun = {
  id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  error_summary: string | null;
};

export type PendingManualSyncRequest = {
  id: string;
  requested_at: string;
};

export type LatestSyncStatus = {
  lastRun: LatestSyncRun | null;
  pendingManualRequest: PendingManualSyncRequest | null;
};

/**
 * Read-only status for the "Sync IBKR now" button (Shadowlist page): the
 * most recent broker_sync_runs row (whatever a scheduled or manually
 * picked-up run last did) and whether a manual request is still waiting
 * to be picked up by the next Routine firing.
 */
export async function getLatestSyncStatus(): Promise<
  { data: LatestSyncStatus; error: null } | { data: null; error: string }
> {
  try {
    const supabase = getSupabaseAdmin();

    const [{ data: lastRun, error: lastRunError }, { data: pending, error: pendingError }] = await Promise.all([
      supabase
        .from("broker_sync_runs")
        .select("id, status, started_at, completed_at, error_summary")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("manual_sync_requests")
        .select("id, requested_at")
        .eq("status", "pending")
        .order("requested_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (lastRunError || pendingError) {
      console.error("getLatestSyncStatus failed", lastRunError, pendingError);
      return { data: null, error: "Sync-Status konnte nicht geladen werden." };
    }

    return {
      data: {
        lastRun: (lastRun as LatestSyncRun | null) ?? null,
        pendingManualRequest: (pending as PendingManualSyncRequest | null) ?? null,
      },
      error: null,
    };
  } catch (e) {
    console.error("getLatestSyncStatus failed", e);
    return { data: null, error: "Sync-Status konnte nicht geladen werden." };
  }
}
