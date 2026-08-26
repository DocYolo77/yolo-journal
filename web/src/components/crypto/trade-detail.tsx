"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  closeCryptoTradeAction,
  addCryptoLessonToLearningsAction,
  reopenCryptoTradeAction,
  updateCryptoTradeAction,
  updateCryptoTradeAftercareAction,
  uploadCryptoScreenshotAction,
} from "@/app/crypto/actions";
import { CRYPTO_DIRECTIONS, CRYPTO_PRODUCTS } from "@/lib/validation/crypto";
import type { CryptoTradeRow } from "@/lib/supabase/types";

const inputClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none disabled:opacity-60";
const textareaClass = `${inputClass} min-h-24`;
const labelClass = "text-xs text-muted-foreground";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  );
}

function ScreenshotSlot({
  tradeId,
  slot,
  url,
  disabled,
}: {
  tradeId: string;
  slot: "entry" | "after";
  url: string | null;
  disabled?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setError(null);
    const formData = new FormData();
    formData.set("screenshot", file);
    startTransition(async () => {
      const result = await uploadCryptoScreenshotAction(tradeId, slot, formData);
      if (result.error) setError(result.error);
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  return (
    <div className="space-y-2">
      <p className={labelClass}>{slot === "entry" ? "Entry Screenshot" : "After Screenshot"}</p>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL, not a static asset Next can optimize.
        <img src={url} alt={slot === "entry" ? "Entry Screenshot" : "After Screenshot"} className="w-full rounded-md border border-border object-contain" />
      ) : (
        <div className="flex h-40 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
          Kein Screenshot
        </div>
      )}
      {!disabled ? (
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept="image/*" className="text-xs text-muted-foreground" />
          <button
            type="button"
            onClick={upload}
            disabled={isPending}
            className="shrink-0 rounded-md border border-accent/50 px-2.5 py-1 text-xs text-accent hover:bg-accent/10 disabled:opacity-60"
          >
            {isPending ? "Lädt…" : "Hochladen"}
          </button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Gesperrt — Trade ist abgeschlossen.</p>
      )}
      {error ? <p className="text-xs text-negative">{error}</p> : null}
    </div>
  );
}

export function CryptoTradeDetail({
  trade,
  screenshotUrls,
}: {
  trade: CryptoTradeRow;
  screenshotUrls: { entry: string | null; after: string | null };
}) {
  const router = useRouter();
  const isOpen = trade.status === "OPEN";

  const basicsFormRef = useRef<HTMLFormElement>(null);
  const [basicsPending, startBasics] = useTransition();
  const [basicsError, setBasicsError] = useState<string | null>(null);
  const [basicsSaved, setBasicsSaved] = useState(false);

  const aftercareFormRef = useRef<HTMLFormElement>(null);
  const [aftercarePending, startAftercare] = useTransition();
  const [aftercareError, setAftercareError] = useState<string | null>(null);
  const [aftercareSaved, setAftercareSaved] = useState(false);

  const [tagsInput, setTagsInput] = useState("");
  const [learningPending, startLearning] = useTransition();
  const [learningError, setLearningError] = useState<string | null>(null);
  const [learningAdded, setLearningAdded] = useState(false);

  const [statusPending, startStatus] = useTransition();
  const [statusError, setStatusError] = useState<string | null>(null);

  function saveBasics() {
    if (!basicsFormRef.current) return;
    setBasicsError(null);
    setBasicsSaved(false);
    const formData = new FormData(basicsFormRef.current);
    startBasics(async () => {
      const result = await updateCryptoTradeAction(trade.id, formData);
      if (result.error) {
        setBasicsError(result.error);
        return;
      }
      setBasicsSaved(true);
    });
  }

  function saveAftercare() {
    if (!aftercareFormRef.current) return;
    setAftercareError(null);
    setAftercareSaved(false);
    const formData = new FormData(aftercareFormRef.current);
    startAftercare(async () => {
      const result = await updateCryptoTradeAftercareAction(trade.id, formData);
      if (result.error) {
        setAftercareError(result.error);
        return;
      }
      setAftercareSaved(true);
    });
  }

  function addToLearnings() {
    setLearningError(null);
    setLearningAdded(false);
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    startLearning(async () => {
      const result = await addCryptoLessonToLearningsAction(trade.id, tags);
      if (result.error) {
        setLearningError(result.error);
        return;
      }
      setLearningAdded(true);
    });
  }

  function closeTrade() {
    setStatusError(null);
    startStatus(async () => {
      const result = await closeCryptoTradeAction(trade.id);
      if (result.error) setStatusError(result.error);
      else router.refresh();
    });
  }

  function reopenTrade() {
    setStatusError(null);
    startStatus(async () => {
      const result = await reopenCryptoTradeAction(trade.id);
      if (result.error) setStatusError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface p-4">
        <div className="flex items-center gap-3">
          <span
            className={`rounded px-2 py-1 text-xs font-semibold uppercase tracking-wide ${
              isOpen ? "bg-accent/15 text-accent" : "bg-border text-muted-foreground"
            }`}
          >
            {isOpen ? "Aktive Position" : "Abgeschlossen"}
          </span>
          {trade.closed_at ? (
            <span className="text-xs text-muted-foreground">Abgeschlossen am {new Date(trade.closed_at).toLocaleString("de-DE")}</span>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {statusError ? <p className="text-xs text-negative">{statusError}</p> : null}
          {isOpen ? (
            <button
              type="button"
              onClick={closeTrade}
              disabled={statusPending}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:opacity-90 disabled:opacity-60"
            >
              {statusPending ? "…" : "Trade abschließen"}
            </button>
          ) : (
            <button
              type="button"
              onClick={reopenTrade}
              disabled={statusPending}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground disabled:opacity-60"
            >
              {statusPending ? "…" : "Trade wieder öffnen"}
            </button>
          )}
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Basisdaten &amp; Thesis</h2>
        <form ref={basicsFormRef} className="space-y-4 rounded-md border border-border bg-surface p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Datum">
              <input type="date" name="trade_date" defaultValue={trade.trade_date} disabled={!isOpen} required className={inputClass} />
            </Field>
            <Field label="Coin">
              <input type="text" name="coin" defaultValue={trade.coin} disabled={!isOpen} required className={inputClass} />
            </Field>
            <Field label="Richtung">
              <select name="direction" defaultValue={trade.direction} disabled={!isOpen} className={inputClass}>
                {CRYPTO_DIRECTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Produkt">
              <select name="product" defaultValue={trade.product} disabled={!isOpen} className={inputClass}>
                {CRYPTO_PRODUCTS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Risiko $">
              <input type="number" step="any" name="risk_usd" defaultValue={trade.risk_usd ?? ""} disabled={!isOpen} className={inputClass} />
            </Field>
            <Field label="Risiko %">
              <input type="number" step="any" name="risk_pct" defaultValue={trade.risk_pct ?? ""} disabled={!isOpen} className={inputClass} />
            </Field>
            <Field label="Ergebnis $">
              <input type="number" step="any" name="result_usd" defaultValue={trade.result_usd ?? ""} disabled={!isOpen} className={inputClass} />
            </Field>
            <Field label="Ergebnis R">
              <input type="number" step="any" name="result_r" defaultValue={trade.result_r ?? ""} disabled={!isOpen} className={inputClass} />
            </Field>
          </div>

          <Field label="Thesis — Warum nehme ich diesen Trade?">
            <textarea name="thesis" defaultValue={trade.thesis ?? ""} disabled={!isOpen} className={textareaClass} />
          </Field>

          <Field label="Management — Plan, Anpassungen, Partials, Adds, vorzeitige Exits">
            <textarea name="management" defaultValue={trade.management ?? ""} disabled={!isOpen} className={textareaClass} />
          </Field>

          {isOpen ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={saveBasics}
                disabled={basicsPending}
                className="rounded-md border border-accent/50 px-3 py-2 text-sm text-accent hover:bg-accent/10 disabled:opacity-60"
              >
                {basicsPending ? "Speichert…" : "Speichern"}
              </button>
              {basicsError ? <p className="text-xs text-negative">{basicsError}</p> : null}
              {basicsSaved && !basicsError ? <p className="text-xs text-positive">Gespeichert.</p> : null}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Gesperrt — Basisdaten und Management sind final, seit der Trade abgeschlossen wurde.</p>
          )}
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Screenshots</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ScreenshotSlot tradeId={trade.id} slot="entry" url={screenshotUrls.entry} disabled={!isOpen} />
          <ScreenshotSlot tradeId={trade.id} slot="after" url={screenshotUrls.after} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Review &amp; Lesson</h2>
        <form ref={aftercareFormRef} className="space-y-4 rounded-md border border-border bg-surface p-4">
          <Field label="Was lief gut?">
            <textarea name="review_good" defaultValue={trade.review_good ?? ""} className={textareaClass} />
          </Field>
          <Field label="Was lief schlecht?">
            <textarea name="review_bad" defaultValue={trade.review_bad ?? ""} className={textareaClass} />
          </Field>
          <Field label="Was mache ich beim nächsten Mal besser?">
            <textarea name="review_better" defaultValue={trade.review_better ?? ""} className={textareaClass} />
          </Field>
          <Field label="Lesson — kurze, generalisierbare Erkenntnis">
            <textarea name="lesson" defaultValue={trade.lesson ?? ""} className={textareaClass} />
          </Field>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={saveAftercare}
              disabled={aftercarePending}
              className="rounded-md border border-accent/50 px-3 py-2 text-sm text-accent hover:bg-accent/10 disabled:opacity-60"
            >
              {aftercarePending ? "Speichert…" : "Speichern"}
            </button>
            {aftercareError ? <p className="text-xs text-negative">{aftercareError}</p> : null}
            {aftercareSaved && !aftercareError ? <p className="text-xs text-positive">Gespeichert.</p> : null}
          </div>
        </form>

        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface p-3">
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="Tags (optional, mit Komma getrennt)"
            className={`${inputClass} max-w-xs`}
          />
          <button
            type="button"
            onClick={addToLearnings}
            disabled={learningPending || !trade.lesson}
            className="rounded-md border border-accent/50 px-3 py-2 text-sm text-accent hover:bg-accent/10 disabled:opacity-60"
          >
            {learningPending ? "…" : "Zu Learnings hinzufügen"}
          </button>
          {!trade.lesson ? <p className="text-xs text-muted-foreground">Erst Lesson eintragen und speichern.</p> : null}
          {learningError ? <p className="text-xs text-negative">{learningError}</p> : null}
          {learningAdded && !learningError ? <p className="text-xs text-positive">Zu Learnings hinzugefügt.</p> : null}
        </div>
      </section>
    </div>
  );
}
