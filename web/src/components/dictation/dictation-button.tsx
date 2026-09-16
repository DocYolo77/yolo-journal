"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

// A site-wide dictation button — fixed top-right, present on every page
// (mounted once in app/layout.tsx, not per-page). Click it, speak German,
// and the recognized text is typed into whichever input/textarea last had
// focus, as if you'd typed it yourself. There is no shared "active field"
// concept anywhere else in this app (every field manages its own local
// state + autosave), so this works at the DOM level instead of through
// React state: it writes through each element's native value setter and
// dispatches a real "input" event, which is what makes React's own
// onChange fire on a value it didn't set itself. That's the only part of
// this component that's a little unusual — everything else is the
// standard Web Speech API.
//
// Browser support: Chrome/Edge only (window.webkitSpeechRecognition).
// Firefox and Safari don't implement SpeechRecognition at all as of this
// writing — the button renders disabled there rather than pretending to
// work.

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** True for the kind of field dictation can actually type into. */
function isDictatableElement(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return !el.disabled && !el.readOnly;
  if (el instanceof HTMLInputElement) {
    const dictatableTypes = ["text", "search", "url", "tel", "email"];
    return !el.disabled && !el.readOnly && dictatableTypes.includes(el.type);
  }
  return false;
}

/**
 * Writes `text` into el at the current cursor position via the native
 * value setter, then dispatches a real "input" event — the standard way
 * to make a React-controlled field's onChange fire on a value change
 * React didn't initiate itself (setting `.value` directly is invisible
 * to React, since React tracks changes through its own overridden
 * setter; going through the native prototype setter instead makes
 * React's change-detection see a real difference on the next event).
 */
function insertTextAtCursor(el: HTMLInputElement | HTMLTextAreaElement, text: string) {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const before = el.value.slice(0, start);
  const after = el.value.slice(end);
  const needsSpaceBefore = before.length > 0 && !/\s$/.test(before) ? " " : "";
  const insertion = `${needsSpaceBefore}${text} `;
  const newValue = before + insertion + after;

  const proto = el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  const nativeSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (nativeSetter) {
    nativeSetter.call(el, newValue);
  } else {
    el.value = newValue;
  }
  el.dispatchEvent(new Event("input", { bubbles: true }));

  const cursor = before.length + insertion.length;
  el.setSelectionRange(cursor, cursor);
}

type DictationState = "idle" | "listening" | "error";

// Static (never changes after mount) but only knowable client-side —
// useSyncExternalStore is the React-recommended way to read this kind of
// browser-only value without a hydration mismatch or a setState-in-effect.
function subscribeNever() {
  return () => {};
}
function getSupportSnapshot() {
  return getSpeechRecognitionConstructor() !== null;
}
function getSupportServerSnapshot() {
  return false;
}

export function DictationButton() {
  const isSupported = useSyncExternalStore(subscribeNever, getSupportSnapshot, getSupportServerSnapshot);
  const [state, setState] = useState<DictationState>("idle");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const shouldListenRef = useRef(false);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    recognitionRef.current?.stop();
    setState("idle");
    setInterim("");
  }, []);

  const startListening = useCallback(() => {
    const Ctor = getSpeechRecognitionConstructor();
    if (!Ctor) return;

    setError(null);
    shouldListenRef.current = true;

    const recognition = new Ctor();
    recognition.lang = "de-DE";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let latestInterim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript.trim();
        if (!transcript) continue;
        if (result.isFinal) {
          const active = document.activeElement;
          if (isDictatableElement(active)) insertTextAtCursor(active, transcript);
        } else {
          latestInterim = transcript;
        }
      }
      setInterim(latestInterim);
    };

    recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      shouldListenRef.current = false;
      setState("error");
      setError(
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "Mikrofon-Zugriff verweigert."
          : "Diktat-Fehler — bitte erneut versuchen."
      );
    };

    recognition.onend = () => {
      // Chrome stops recognition on its own after a pause even in
      // continuous mode — restart transparently as long as the user
      // hasn't clicked stop.
      if (shouldListenRef.current) {
        recognition.start();
      } else {
        setState("idle");
        setInterim("");
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setState("listening");
  }, []);

  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      recognitionRef.current?.abort();
    };
  }, []);

  function handleClick() {
    if (state === "listening") {
      stopListening();
    } else {
      startListening();
    }
  }

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col items-end gap-2">
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleClick}
        disabled={!isSupported}
        title={
          !isSupported
            ? "Diktat wird von diesem Browser nicht unterstützt (Chrome/Edge verwenden)."
            : state === "listening"
              ? "Diktat stoppen"
              : "Diktat starten — schreibt ins zuletzt fokussierte Feld"
        }
        aria-pressed={state === "listening"}
        aria-label={state === "listening" ? "Diktat stoppen" : "Diktat starten"}
        className={`flex h-10 w-10 items-center justify-center rounded-full border shadow-sm transition-colors ${
          !isSupported
            ? "cursor-not-allowed border-border bg-surface text-muted-foreground/50"
            : state === "listening"
              ? "border-negative bg-negative/10 text-negative"
              : state === "error"
                ? "border-negative/40 bg-surface text-negative"
                : "border-border bg-surface text-muted-foreground hover:border-accent/40 hover:text-accent"
        }`}
      >
        {state === "listening" ? (
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-negative" aria-hidden="true" />
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="9" y="2" width="6" height="12" rx="3" />
            <path d="M5 10v1a7 7 0 0 0 14 0v-1" />
            <path d="M12 19v3M8 22h8" />
          </svg>
        )}
      </button>
      {state === "listening" && interim ? (
        <p className="max-w-xs rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
          {interim}
        </p>
      ) : null}
      {state === "error" && error ? (
        <p className="max-w-xs rounded-md border border-negative/40 bg-negative/10 px-3 py-1.5 text-xs text-negative shadow-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
