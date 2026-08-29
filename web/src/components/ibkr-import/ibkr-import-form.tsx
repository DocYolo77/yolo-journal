"use client";

import { useRef, useState, useTransition } from "react";
import { runIbkrJsonImportAction, validateIbkrJsonImportAction } from "@/app/ibkr-import/actions";
import type { IbkrJsonImportPreview } from "@/lib/broker/ibkr-json-import";

const inputClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none";

function formatMoney(value: number | null, currency: string): string {
  return value == null ? "–" : `${value.toFixed(2)} ${currency}`;
}

export function IbkrImportForm({ defaultDate }: { defaultDate: string }) {
  const [reviewDate, setReviewDate] = useState(defaultDate);
  const [rawText, setRawText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isValidating, startValidate] = useTransition();
  const [validationErrors, setValidationErrors] = useState<string[] | null>(null);
  const [preview, setPreview] = useState<IbkrJsonImportPreview | null>(null);
  const [existingDataForDate, setExistingDataForDate] = useState(false);

  const [isImporting, startImport] = useTransition();
  const [importError, setImportError] = useState<string | null>(null);
  const [importNotes, setImportNotes] = useState<string[] | null>(null);
  const [importedOk, setImportedOk] = useState(false);
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);

  function resetResults() {
    setValidationErrors(null);
    setPreview(null);
    setExistingDataForDate(false);
    setImportError(null);
    setImportNotes(null);
    setImportedOk(false);
    setShowReplaceConfirm(false);
  }

  function handleFileUpload(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setRawText(reader.result);
        resetResults();
      }
    };
    reader.readAsText(file);
  }

  function handleValidate() {
    resetResults();
    startValidate(async () => {
      const result = await validateIbkrJsonImportAction(reviewDate, rawText);
      if (!result.success) {
        setValidationErrors(result.errors);
        return;
      }
      setPreview(result.preview);
      setExistingDataForDate(result.existingDataForDate);
    });
  }

  function handleImport(confirmReplace: boolean) {
    setImportError(null);
    setImportNotes(null);
    setImportedOk(false);
    setShowReplaceConfirm(false);
    startImport(async () => {
      const result = await runIbkrJsonImportAction(reviewDate, rawText, confirmReplace);
      if (result.status === "failed") {
        setImportError(result.error);
        return;
      }
      if (result.status === "validation_failed") {
        setValidationErrors(result.errors);
        setPreview(null);
        return;
      }
      if (result.status === "blocked_existing_data") {
        setShowReplaceConfirm(true);
        return;
      }
      setImportedOk(true);
      setImportNotes(result.notes);
    });
  }

  function handleClear() {
    setRawText("");
    setReviewDate(defaultDate);
    if (fileInputRef.current) fileInputRef.current.value = "";
    resetResults();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-border bg-surface p-4">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Trading Date / Review Date
          <input
            type="date"
            value={reviewDate}
            onChange={(e) => {
              setReviewDate(e.target.value);
              resetResults();
            }}
            className={`max-w-xs ${inputClass}`}
          />
        </label>
      </div>

      <div className="space-y-3 rounded-md border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-foreground">JSON Import</h2>

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
            }}
            className="text-xs text-muted-foreground"
          />
          <span className="text-xs text-muted-foreground">oder unten einfügen</span>
        </div>

        <textarea
          value={rawText}
          onChange={(e) => {
            setRawText(e.target.value);
            resetResults();
          }}
          placeholder="JSON hier einfügen…"
          rows={14}
          className={`${inputClass} font-mono text-xs`}
        />

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleValidate}
            disabled={isValidating || !rawText.trim()}
            className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover disabled:opacity-60"
          >
            {isValidating ? "Prüft…" : "Validate"}
          </button>
          <button
            type="button"
            onClick={() => handleImport(false)}
            disabled={isImporting || !preview}
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition-colors hover:opacity-90 disabled:opacity-60"
          >
            {isImporting ? "Importiert…" : "Import"}
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface-hover"
          >
            Clear
          </button>
        </div>

        {validationErrors ? (
          <div className="space-y-1 rounded-md border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-negative">
            {validationErrors.map((err, i) => (
              <p key={i}>{err}</p>
            ))}
          </div>
        ) : null}

        {preview ? (
          <div className="space-y-2 rounded-md border border-accent/40 bg-accent/5 px-3 py-3 text-sm">
            <p className="font-medium text-foreground">Import-Vorschau</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground sm:grid-cols-3">
              <span>Date: {preview.reviewDate}</span>
              <span>NLV: {formatMoney(preview.netLiquidationValue, preview.baseCurrency)}</span>
              <span>Executions: {preview.executionsCount}</span>
              <span>Open Positions: {preview.openPositionsCount}</span>
              <span>Gross Exposure: {formatMoney(preview.grossExposure, preview.baseCurrency)}</span>
              <span>Realized PnL: {formatMoney(preview.realizedPnlDay, preview.baseCurrency)}</span>
            </div>
            {existingDataForDate ? (
              <p className="text-xs text-negative">
                Für diesen Handelstag existieren bereits IBKR-Daten — beim Import wirst du gefragt, ob sie ersetzt
                werden sollen.
              </p>
            ) : null}
          </div>
        ) : null}

        {showReplaceConfirm ? (
          <div className="space-y-3 rounded-md border border-negative/40 bg-negative/10 px-3 py-3 text-sm">
            <p className="text-negative">Für diesen Handelstag existieren bereits IBKR-Daten.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleImport(true)}
                disabled={isImporting}
                className="rounded-md border border-negative/50 px-3 py-1.5 text-xs text-negative hover:bg-negative/10 disabled:opacity-60"
              >
                Replace existing data
              </button>
              <button
                type="button"
                onClick={() => setShowReplaceConfirm(false)}
                className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-surface-hover"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {importError ? <p className="text-sm text-negative">{importError}</p> : null}

        {importedOk ? (
          <div className="space-y-1 rounded-md border border-positive/40 bg-positive/10 px-3 py-2 text-sm">
            <p className="font-medium text-positive">
              Import für {reviewDate} abgeschlossen — Daily Review erkennt diese Daten automatisch.
            </p>
            {importNotes && importNotes.length > 0 ? (
              <ul className="list-inside list-disc text-xs text-muted-foreground">
                {importNotes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
