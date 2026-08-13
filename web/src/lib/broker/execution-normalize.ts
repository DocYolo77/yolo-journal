import { createHash } from "node:crypto";
import type { RawExecution } from "./provider";

/**
 * Deduplication key for broker_executions (unique on (provider, this
 * value) — see 20260813180619_create_market_data_and_broker_schema.sql).
 * Prefers the provider's own execution id; falls back to a deterministic
 * hash of the fields that together identify a specific fill, so a
 * missing provider id never causes a silent duplicate import on re-sync.
 */
export function computeDedupKey(execution: RawExecution): string {
  if (execution.providerExecutionId) {
    return execution.providerExecutionId;
  }

  const fallbackInput = [
    execution.symbol,
    execution.side,
    execution.quantity,
    execution.price,
    execution.executedAt,
    execution.orderId,
  ].join("|");

  return createHash("sha256").update(fallbackInput).digest("hex");
}
