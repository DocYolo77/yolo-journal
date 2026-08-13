"use client";

import { useActionState } from "react";
import { loginAction, type LoginFormState } from "@/app/login/actions";

const emptyState: LoginFormState = { error: null };

const inputClass =
  "rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, emptyState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <p className="rounded-md border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-negative">
          {state.error}
        </p>
      ) : null}
      <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
        E-Mail
        <input name="email" type="email" required autoComplete="email" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
        Passwort
        <input name="password" type="password" required autoComplete="current-password" className={inputClass} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90 disabled:opacity-60"
      >
        {pending ? "Anmelden…" : "Anmelden"}
      </button>
    </form>
  );
}
