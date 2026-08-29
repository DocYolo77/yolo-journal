"use server";

import { revalidatePath } from "next/cache";
import {
  runIbkrJsonImport,
  validateIbkrJsonImportForPreview,
  type IbkrJsonImportResult,
  type IbkrJsonValidateResult,
} from "@/lib/broker/ibkr-json-import";

// Plain async Server Actions invoked directly from client onClick
// handlers (not via <form action>/useActionState) — same pattern as
// Lessons Learned / Crypto: Validate is a read-only preview call with no
// DB writes, and Import needs to pass through a client-held
// confirmReplace flag from the "existing data" warning dialog, neither
// of which fits cleanly into a single useActionState-bound form.

export async function validateIbkrJsonImportAction(reviewDate: string, rawText: string): Promise<IbkrJsonValidateResult> {
  return validateIbkrJsonImportForPreview(rawText, reviewDate);
}

export async function runIbkrJsonImportAction(
  reviewDate: string,
  rawText: string,
  confirmReplace: boolean
): Promise<IbkrJsonImportResult | { status: "failed"; errors: null; error: string }> {
  try {
    const result = await runIbkrJsonImport(reviewDate, rawText, confirmReplace);
    if (result.status === "success" || result.status === "partial") {
      revalidatePath("/ibkr-import");
      revalidatePath("/shadowlist");
      revalidatePath("/daily-review");
      revalidatePath("/archive");
    }
    return result;
  } catch (e) {
    console.error("runIbkrJsonImportAction failed", e);
    const message = e instanceof Error ? e.message : "IBKR-JSON-Import fehlgeschlagen.";
    return { status: "failed", errors: null, error: message };
  }
}
