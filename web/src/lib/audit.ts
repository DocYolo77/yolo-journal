import { createHash } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";

// Append-only, hash-chained event ledger writer.
// See LEGACY_JOURNAL_OS_V7_4_3_REFERENCE.md §5.
//
// Hashing happens here (application layer), not in the database: each new
// event's hash covers the previous event's hash plus this event's own
// content, so the chain can later be walked and verified for tampering.
// Single-writer V1 assumption: concurrent writers could race on reading
// the "last" hash, which is acceptable for a single-user tool but would
// need a DB-side serialization point (e.g. advisory lock) under real
// concurrent multi-user load.

/**
 * Appends the real Postgres error detail instead of swallowing it —
 * same reasoning/pattern as app/actions.ts's describeSupabaseError: a
 * generic "Audit-Event konnte nicht gespeichert werden." with the real
 * cause only in a server log neither the user nor this assistant can
 * see makes a genuine failure indistinguishable from "nothing to
 * report."
 */
function describeSupabaseError(error: { message?: string; code?: string; details?: string; hint?: string } | null): string {
  if (!error) return "";
  const parts = [error.message, error.code ? `Code: ${error.code}` : null, error.details, error.hint].filter(Boolean);
  return parts.length > 0 ? ` (${parts.join(" · ")})` : "";
}

export type AuditEventInput = {
  eventType: string;
  tradeDate: string | null;
  entityType: string;
  entityId: string | null;
  actor?: string | null;
  payload?: Record<string, unknown> | null;
};

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value !== null && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
}

function canonicalize(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

export async function appendAuditEvent(
  input: AuditEventInput
): Promise<{ error: string | null }> {
  try {
    const supabase = getSupabaseAdmin();

    const { data: lastEvent, error: lastEventError } = await supabase
      .from("audit_events")
      .select("hash")
      .order("seq", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastEventError) {
      console.error("appendAuditEvent: failed to read last event", lastEventError);
      return { error: `Audit-Event konnte nicht gespeichert werden.${describeSupabaseError(lastEventError)}` };
    }

    const previousHash = (lastEvent?.hash as string | undefined) ?? null;
    const eventTime = new Date().toISOString();

    const hashInput = canonicalize({
      event_type: input.eventType,
      event_time: eventTime,
      trade_date: input.tradeDate,
      entity_type: input.entityType,
      entity_id: input.entityId,
      actor: input.actor ?? null,
      payload: input.payload ?? null,
      previous_hash: previousHash,
    });

    const hash = createHash("sha256").update(hashInput).digest("hex");

    const { error: insertError } = await supabase.from("audit_events").insert({
      event_time: eventTime,
      event_type: input.eventType,
      trade_date: input.tradeDate,
      entity_type: input.entityType,
      entity_id: input.entityId,
      actor: input.actor ?? null,
      payload: input.payload ?? null,
      previous_hash: previousHash,
      hash,
    });

    if (insertError) {
      console.error("appendAuditEvent: failed to insert event", insertError);
      return { error: `Audit-Event konnte nicht gespeichert werden.${describeSupabaseError(insertError)}` };
    }

    return { error: null };
  } catch (e) {
    console.error("appendAuditEvent failed", e);
    const detail = e instanceof Error ? ` (${e.message})` : "";
    return { error: `Audit-Event konnte nicht gespeichert werden.${detail}` };
  }
}
