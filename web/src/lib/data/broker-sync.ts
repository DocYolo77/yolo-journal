import { getSupabaseAdmin } from "@/lib/supabase/server";

export type LatestSyncRun = {
  id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  error_summary: string | null;
};

/**
 * Read-only status for the "Sync IBKR now" button (Shadowlist page):
 * the most recent broker_sync_runs row, shown until the button is
 * clicked and a live result (lib/broker/ibkr-sync.ts's IbkrSyncSummary)
 * takes over for that page load.
 */
export async function getLatestSyncRun(): Promise<
  { data: LatestSyncRun | null; error: null } | { data: null; error: string }
> {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("broker_sync_runs")
      .select("id, status, started_at, completed_at, error_summary")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("getLatestSyncRun failed", error);
      return { data: null, error: "Sync-Status konnte nicht geladen werden." };
    }

    return { data: (data as LatestSyncRun | null) ?? null, error: null };
  } catch (e) {
    console.error("getLatestSyncRun failed", e);
    return { data: null, error: "Sync-Status konnte nicht geladen werden." };
  }
}
