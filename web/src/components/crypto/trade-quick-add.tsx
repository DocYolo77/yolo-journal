"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCryptoTradeAction } from "@/app/crypto/actions";
import { CRYPTO_DIRECTIONS, CRYPTO_PRODUCTS } from "@/lib/validation/crypto";

const inputClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Minimal quick-add: date/coin/direction/product only, per the "Trade
 * dokumentieren -> fertig innerhalb weniger Minuten" UX principle —
 * everything else (thesis, screenshots, management, review, lesson) is
 * filled in on the trade's own detail page right after creation.
 */
export function CryptoTradeQuickAdd() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!formRef.current) return;
    setError(null);
    const formData = new FormData(formRef.current);
    startTransition(async () => {
      const result = await createCryptoTradeAction(formData);
      if (result.error || !result.data) {
        setError(result.error ?? "Trade konnte nicht angelegt werden.");
        return;
      }
      router.push(`/crypto/${result.data.id}`);
    });
  }

  return (
    <form ref={formRef} className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-surface p-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Datum</label>
        <input type="date" name="trade_date" defaultValue={todayIso()} required className={inputClass} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Coin</label>
        <input type="text" name="coin" placeholder="BTC" required className={`${inputClass} w-28`} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Richtung</label>
        <select name="direction" defaultValue={CRYPTO_DIRECTIONS[0]} className={inputClass}>
          {CRYPTO_DIRECTIONS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Produkt</label>
        <select name="product" defaultValue={CRYPTO_PRODUCTS[0]} className={inputClass}>
          {CRYPTO_PRODUCTS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        onClick={submit}
        disabled={isPending}
        className="rounded-md border border-accent/50 px-3 py-2 text-sm text-accent transition-colors hover:bg-accent/10 disabled:opacity-60"
      >
        {isPending ? "Anlegen…" : "Neuer Trade"}
      </button>
      {error ? <p className="w-full text-xs text-negative">{error}</p> : null}
    </form>
  );
}
