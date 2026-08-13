import { getSupabaseAdmin } from "@/lib/supabase/server";
import type {
  AuditEventRow,
  CommitmentEpCandidateRow,
  CommitmentRiskChangeRow,
  CommitmentRow,
  CommitmentWatchlistItemRow,
} from "@/lib/supabase/types";

export type CommitmentWithChildren = CommitmentRow & {
  watchlist: CommitmentWatchlistItemRow[];
  ep_candidates: CommitmentEpCandidateRow[];
};

export async function getLatestCommitmentForDate(
  tradeDate: string
): Promise<
  { data: CommitmentWithChildren | null; error: null } | { data: null; error: string }
> {
  try {
    const supabase = getSupabaseAdmin();

    const { data: commitment, error: commitmentError } = await supabase
      .from("commitments")
      .select("*")
      .eq("trade_date", tradeDate)
      .order("revision", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (commitmentError) {
      console.error("getLatestCommitmentForDate failed", commitmentError);
      return { data: null, error: "Commitment konnte nicht geladen werden." };
    }

    if (!commitment) {
      return { data: null, error: null };
    }

    const [{ data: watchlist, error: watchlistError }, { data: epCandidates, error: epError }] =
      await Promise.all([
        supabase
          .from("commitment_watchlist_items")
          .select("*")
          .eq("commitment_id", commitment.id)
          .order("sort_order", { ascending: true }),
        supabase
          .from("commitment_ep_candidates")
          .select("*")
          .eq("commitment_id", commitment.id)
          .order("created_at", { ascending: true }),
      ]);

    if (watchlistError || epError) {
      console.error("getLatestCommitmentForDate failed", watchlistError ?? epError);
      return { data: null, error: "Commitment konnte nicht vollständig geladen werden." };
    }

    return {
      data: {
        ...(commitment as CommitmentRow),
        watchlist: watchlist ?? [],
        ep_candidates: epCandidates ?? [],
      },
      error: null,
    };
  } catch (e) {
    console.error("getLatestCommitmentForDate failed", e);
    return { data: null, error: "Commitment konnte nicht geladen werden." };
  }
}

export async function listRiskChanges(
  commitmentId: string
): Promise<{ data: CommitmentRiskChangeRow[]; error: null } | { data: null; error: string }> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("commitment_risk_changes")
      .select("*")
      .eq("commitment_id", commitmentId)
      .order("changed_at", { ascending: false });

    if (error) {
      console.error("listRiskChanges failed", error);
      return { data: null, error: "Risiko-Änderungen konnten nicht geladen werden." };
    }

    return { data: data ?? [], error: null };
  } catch (e) {
    console.error("listRiskChanges failed", e);
    return { data: null, error: "Risiko-Änderungen konnten nicht geladen werden." };
  }
}

export async function listRecentAuditEventsForTradeDate(
  tradeDate: string,
  limit = 20
): Promise<{ data: AuditEventRow[]; error: null } | { data: null; error: string }> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("audit_events")
      .select("*")
      .eq("trade_date", tradeDate)
      .order("seq", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("listRecentAuditEventsForTradeDate failed", error);
      return { data: null, error: "Audit-Trail konnte nicht geladen werden." };
    }

    return { data: data ?? [], error: null };
  } catch (e) {
    console.error("listRecentAuditEventsForTradeDate failed", e);
    return { data: null, error: "Audit-Trail konnte nicht geladen werden." };
  }
}
