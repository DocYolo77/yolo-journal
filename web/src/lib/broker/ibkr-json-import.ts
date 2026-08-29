// Orchestrates the manual IBKR JSON import — the fallback ingestion path
// for when the automated Flex sync isn't working. Deliberately mirrors
// runIbkrSync's shape in ibkr-sync.ts and calls the exact same shared
// helpers (insertNewExecutions, insertAccountAndPositionSnapshots,
// reconcileNewExecutions, checkUnresolvedPriorPositions,
// runLockedCommitmentPostProcessing) so there is no second analysis
// path — only the fetch+normalize step differs between the two ingestion
// routes.
//
// Fully deterministic, no LLM anywhere in this file (§16 of the coding
// instruction) — parsing/validation/normalization/storage/reconciliation
// are all plain code.

import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  checkUnresolvedPriorPositions,
  insertAccountAndPositionSnapshots,
  insertNewExecutions,
  reconcileNewExecutions,
  runLockedCommitmentPostProcessing,
} from "./ibkr-sync";
import { normalizeJsonAccountSnapshot, normalizeJsonExecutions, normalizeJsonPositions } from "./ibkr-json-normalize";
import { validateIbkrJsonImport } from "./ibkr-json-validate";
import type { IbkrJsonImport } from "./ibkr-json-types";

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

export type IbkrJsonImportPreview = {
  reviewDate: string;
  netLiquidationValue: number | null;
  baseCurrency: string;
  executionsCount: number;
  openPositionsCount: number;
  grossExposure: number | null;
  realizedPnlDay: number | null;
};

function buildPreview(json: IbkrJsonImport): IbkrJsonImportPreview {
  return {
    reviewDate: json.review_date,
    netLiquidationValue: json.account_snapshot.net_liquidation_value ?? null,
    baseCurrency: json.base_currency,
    executionsCount: json.executions.length,
    openPositionsCount: json.positions.length,
    grossExposure: json.account_snapshot.exposure?.gross_exposure ?? null,
    realizedPnlDay: json.account_snapshot.realized_pnl_day ?? null,
  };
}

/** Any broker_account_snapshots or broker_positions_snapshots row already filed under this trading_date — from either ingestion path. */
export async function hasExistingIbkrDataForDate(supabase: SupabaseAdminClient, reviewDate: string): Promise<boolean> {
  const [accountRows, positionRows] = await Promise.all([
    supabase.from("broker_account_snapshots").select("id").eq("trading_date", reviewDate).limit(1),
    supabase.from("broker_positions_snapshots").select("id").eq("trading_date", reviewDate).limit(1),
  ]);
  return (accountRows.data?.length ?? 0) > 0 || (positionRows.data?.length ?? 0) > 0;
}

export type IbkrJsonValidateResult =
  | { success: true; preview: IbkrJsonImportPreview; existingDataForDate: boolean }
  | { success: false; errors: string[] };

/** Validate + build a preview WITHOUT writing anything — backs the import page's "Validate" button. */
export async function validateIbkrJsonImportForPreview(rawText: string, reviewDate: string): Promise<IbkrJsonValidateResult> {
  const result = validateIbkrJsonImport(rawText, reviewDate);
  if (!result.success) {
    return { success: false, errors: result.errors };
  }

  const supabase = getSupabaseAdmin();
  const existingDataForDate = await hasExistingIbkrDataForDate(supabase, reviewDate);

  return { success: true, preview: buildPreview(result.data), existingDataForDate };
}

export type IbkrJsonImportResult =
  | { status: "blocked_existing_data"; errors: null }
  | { status: "validation_failed"; errors: string[] }
  | {
      status: "success" | "partial";
      errors: null;
      executionsImported: number;
      executionsSkipped: number;
      netLiquidationValue: number | null;
      positionsCount: number;
      notes: string[];
    };

/**
 * Performs the actual import — validate -> (guard against silently
 * overwriting existing data for the day, unless confirmReplace) -> store
 * raw JSON (best-effort, never blocks the real write, same as the PDF
 * storage step in reports/daily/[date]/pdf/route.tsx) -> normalize into
 * the exact same shapes the Flex sync produces -> insert via the shared
 * helpers -> run the shared post-ingestion pipeline.
 */
export async function runIbkrJsonImport(
  reviewDate: string,
  rawText: string,
  confirmReplace: boolean
): Promise<IbkrJsonImportResult> {
  const validation = validateIbkrJsonImport(rawText, reviewDate);
  if (!validation.success) {
    return { status: "validation_failed", errors: validation.errors };
  }
  const json = validation.data;

  const supabase = getSupabaseAdmin();
  const notes: string[] = [];
  let hadPartialIssue = false;

  if (!confirmReplace) {
    const existing = await hasExistingIbkrDataForDate(supabase, reviewDate);
    if (existing) {
      return { status: "blocked_existing_data", errors: null };
    }
  }

  // Best-effort — a failure here must never lose the actual data being
  // imported, only the audit copy of the raw file (§15).
  const { error: rawError } = await supabase.from("ibkr_import_raw").insert({
    review_date: reviewDate,
    schema_version: json.schema_version,
    snapshot_datetime: json.snapshot_datetime ?? null,
    raw_json: json,
  });
  if (rawError) {
    notes.push(`Rohdaten-Archivierung fehlgeschlagen (Import läuft trotzdem weiter): ${rawError.message}`);
    hadPartialIssue = true;
  }

  const importedAt = new Date().toISOString();
  const executions = normalizeJsonExecutions(json);
  const accountSnapshot = normalizeJsonAccountSnapshot(json, { importedAt });
  const positions = normalizeJsonPositions(json, { importedAt });

  const executionsResult = await insertNewExecutions(supabase, executions);
  if (executionsResult.error) {
    notes.push(`Executions-Import fehlgeschlagen: ${executionsResult.error}`);
    hadPartialIssue = true;
  } else if (executionsResult.inserted.length > 0) {
    try {
      const reconcileNotes = await reconcileNewExecutions(supabase, executionsResult.inserted);
      notes.push(...reconcileNotes);
      if (reconcileNotes.length > 0) hadPartialIssue = true;
    } catch (e) {
      notes.push(e instanceof Error ? e.message : "Campaign-Reconciliation fehlgeschlagen.");
      hadPartialIssue = true;
    }
  }

  const snapshotResult = await insertAccountAndPositionSnapshots(supabase, [accountSnapshot], positions);
  if (snapshotResult.error) {
    notes.push(snapshotResult.error);
    hadPartialIssue = true;
  } else if (positions.length > 0) {
    try {
      const priorPositionNotes = await checkUnresolvedPriorPositions(supabase, positions);
      notes.push(...priorPositionNotes);
      if (priorPositionNotes.length > 0) hadPartialIssue = true;
    } catch (e) {
      notes.push(e instanceof Error ? e.message : "Prüfung auf ungeklärte Altpositionen fehlgeschlagen.");
      hadPartialIssue = true;
    }
  }

  const postProcessing = await runLockedCommitmentPostProcessing(supabase, reviewDate);
  notes.push(...postProcessing.notes);
  if (postProcessing.hadPartialIssue) hadPartialIssue = true;

  return {
    status: hadPartialIssue ? "partial" : "success",
    errors: null,
    executionsImported: executionsResult.inserted.length,
    executionsSkipped: executionsResult.skipped,
    netLiquidationValue: accountSnapshot.net_liquidation_value,
    positionsCount: positions.length,
    notes,
  };
}
