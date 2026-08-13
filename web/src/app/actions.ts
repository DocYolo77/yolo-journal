"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getCurrentTradeDateET } from "@/lib/trade-date";
import { appendAuditEvent } from "@/lib/audit";
import { getLatestCommitmentForDate } from "@/lib/data/commitments";
import {
  checkCommitmentCompleteForLock,
  parseCommitmentForm,
  type CommitmentFormState,
} from "@/lib/validation/commitment";
import { MassiveMarketDataProvider } from "@/lib/market-data/massive-provider";
import type { QqqExtensionSnapshot } from "@/lib/market-data/provider";

/**
 * Live QQQ ATR%-extension lookup for the Commitment form's QQQ-Extension
 * section (§2) — see computeAtrPctExtensionFromMa in
 * lib/market-data/indicators.ts for the formula. The manual ATR-Multiple
 * field always stays editable/overridable: this only pre-fills it.
 * Surfaces the real error message (e.g. "MASSIVE_API_KEY is not
 * configured.") rather than swallowing it, since that's exactly the
 * signal for whether the live integration is usable yet.
 */
export async function fetchQqqExtensionAction(): Promise<
  { data: QqqExtensionSnapshot; error: null } | { data: null; error: string }
> {
  try {
    const tradeDate = getCurrentTradeDateET();
    const provider = new MassiveMarketDataProvider();
    const data = await provider.getQqqExtension({ tradeDate });
    return { data, error: null };
  } catch (e) {
    console.error("fetchQqqExtensionAction failed", e);
    const message = e instanceof Error ? e.message : "QQQ-Extension konnte nicht abgerufen werden.";
    return { data: null, error: message };
  }
}

export async function saveDraftAction(
  _prevState: CommitmentFormState,
  formData: FormData
): Promise<CommitmentFormState> {
  const result = parseCommitmentForm(formData);

  if (!result.success) {
    return { fieldErrors: result.fieldErrors, formError: result.formError };
  }

  const tradeDate = getCurrentTradeDateET();
  const supabase = getSupabaseAdmin();

  const { data: existing, error: existingError } = await getLatestCommitmentForDate(tradeDate);

  if (existingError) {
    return { fieldErrors: {}, formError: existingError };
  }

  if (existing && existing.status === "LOCKED") {
    return {
      fieldErrors: {},
      formError:
        "Das heutige Commitment ist bereits gelockt und kann nicht mehr als Draft überschrieben werden.",
    };
  }

  const nextRevision = existing ? existing.revision + 1 : 1;
  const { watchlist, ep_candidates: epCandidates, ...commitmentFields } = result.data;

  try {
    const { data: inserted, error: insertError } = await supabase
      .from("commitments")
      .insert({
        trade_date: tradeDate,
        revision: nextRevision,
        status: "DRAFT",
        ...commitmentFields,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      console.error("saveDraftAction: insert commitment failed", insertError);
      return { fieldErrors: {}, formError: "Commitment konnte nicht gespeichert werden." };
    }

    if (watchlist.length > 0) {
      const { error: watchlistError } = await supabase
        .from("commitment_watchlist_items")
        .insert(watchlist.map((item) => ({ ...item, commitment_id: inserted.id })));

      if (watchlistError) {
        console.error("saveDraftAction: insert watchlist failed", watchlistError);
        // Compensating rollback — cascades to any partially-inserted rows.
        await supabase.from("commitments").delete().eq("id", inserted.id);
        return { fieldErrors: {}, formError: "Commitment konnte nicht vollständig gespeichert werden." };
      }
    }

    if (epCandidates.length > 0) {
      const { error: epError } = await supabase
        .from("commitment_ep_candidates")
        .insert(epCandidates.map((item) => ({ ...item, commitment_id: inserted.id })));

      if (epError) {
        console.error("saveDraftAction: insert ep candidates failed", epError);
        await supabase.from("commitments").delete().eq("id", inserted.id);
        return { fieldErrors: {}, formError: "Commitment konnte nicht vollständig gespeichert werden." };
      }
    }

    await appendAuditEvent({
      eventType: "commitment_saved",
      tradeDate,
      entityType: "commitment",
      entityId: inserted.id,
      payload: { revision: nextRevision },
    });
  } catch (e) {
    console.error("saveDraftAction failed", e);
    return { fieldErrors: {}, formError: "Commitment konnte nicht gespeichert werden." };
  }

  revalidatePath("/");
  return { fieldErrors: {}, success: true };
}

export async function lockAction(
  _prevState: CommitmentFormState,
  formData: FormData
): Promise<CommitmentFormState> {
  // formData is unused but required so this action matches the
  // (state, formData) => State signature useActionState expects.
  void formData;

  const tradeDate = getCurrentTradeDateET();
  const supabase = getSupabaseAdmin();

  const { data: existing, error: existingError } = await getLatestCommitmentForDate(tradeDate);

  if (existingError) {
    return { fieldErrors: {}, formError: existingError };
  }

  if (!existing) {
    return { fieldErrors: {}, formError: "Kein Commitment für heute vorhanden." };
  }

  if (existing.status === "LOCKED") {
    return { fieldErrors: {}, formError: "Commitment ist bereits gelockt." };
  }

  const missing = checkCommitmentCompleteForLock(existing);

  if (missing.length > 0) {
    return {
      fieldErrors: {},
      formError: `Commitment ist noch nicht vollständig: ${missing.join(" ")}`,
    };
  }

  try {
    const { error: lockError } = await supabase
      .from("commitments")
      .update({ status: "LOCKED", locked_at: new Date().toISOString() })
      .eq("id", existing.id);

    if (lockError) {
      console.error("lockAction failed", lockError);
      return { fieldErrors: {}, formError: "Commitment konnte nicht gelockt werden." };
    }

    await appendAuditEvent({
      eventType: "commitment_locked",
      tradeDate,
      entityType: "commitment",
      entityId: existing.id,
      payload: { revision: existing.revision },
    });
  } catch (e) {
    console.error("lockAction failed", e);
    return { fieldErrors: {}, formError: "Commitment konnte nicht gelockt werden." };
  }

  revalidatePath("/");
  return { fieldErrors: {}, success: true };
}

export async function reduceRiskAction(
  _prevState: CommitmentFormState,
  formData: FormData
): Promise<CommitmentFormState> {
  const reasonRaw = formData.get("reason");
  const reason = typeof reasonRaw === "string" ? reasonRaw.trim() : "";
  const newRiskRaw = formData.get("newRiskPct");
  const newRiskStr = typeof newRiskRaw === "string" ? newRiskRaw.trim() : "";

  const fieldErrors: CommitmentFormState["fieldErrors"] = {};

  if (!newRiskStr) {
    fieldErrors.newRiskPct = "Neues Risiko ist erforderlich.";
  }
  if (!reason) {
    fieldErrors.reason = "Begründung ist erforderlich.";
  }

  const newRisk = Number(newRiskStr);
  if (newRiskStr && !Number.isFinite(newRisk)) {
    fieldErrors.newRiskPct = "Neues Risiko muss eine Zahl sein.";
  } else if (newRiskStr && newRisk < 0) {
    fieldErrors.newRiskPct = "Neues Risiko darf nicht negativ sein.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  const tradeDate = getCurrentTradeDateET();
  const supabase = getSupabaseAdmin();

  const { data: existing, error: existingError } = await getLatestCommitmentForDate(tradeDate);

  if (existingError) {
    return { fieldErrors: {}, formError: existingError };
  }

  if (!existing || existing.status !== "LOCKED") {
    return { fieldErrors: {}, formError: "Es gibt kein gelocktes Commitment für heute." };
  }

  const currentRisk = existing.intraday_risk_pct;

  if (currentRisk === null) {
    return { fieldErrors: {}, formError: "Aktuelles Intraday-Risiko ist nicht gesetzt." };
  }

  if (newRisk >= currentRisk) {
    return {
      fieldErrors: {
        newRiskPct: "Neues Risiko muss kleiner als das aktuelle Risiko sein (nur Reduktion erlaubt).",
      },
    };
  }

  try {
    const { error: insertError } = await supabase.from("commitment_risk_changes").insert({
      commitment_id: existing.id,
      old_risk_pct: currentRisk,
      new_risk_pct: newRisk,
      reason,
    });

    if (insertError) {
      console.error("reduceRiskAction: insert risk change failed", insertError);
      return { fieldErrors: {}, formError: "Risiko-Reduktion konnte nicht gespeichert werden." };
    }

    const { error: updateError } = await supabase
      .from("commitments")
      .update({ intraday_risk_pct: newRisk })
      .eq("id", existing.id);

    if (updateError) {
      console.error("reduceRiskAction: update commitment failed", updateError);
      return { fieldErrors: {}, formError: "Risiko-Reduktion konnte nicht vollständig gespeichert werden." };
    }

    await appendAuditEvent({
      eventType: "risk_downgraded",
      tradeDate,
      entityType: "commitment",
      entityId: existing.id,
      payload: { old_risk_pct: currentRisk, new_risk_pct: newRisk, reason },
    });
  } catch (e) {
    console.error("reduceRiskAction failed", e);
    return { fieldErrors: {}, formError: "Risiko-Reduktion konnte nicht gespeichert werden." };
  }

  revalidatePath("/");
  return { fieldErrors: {}, success: true };
}
