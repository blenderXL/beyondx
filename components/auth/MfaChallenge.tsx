"use client";

import { useActionState, useState } from "react";
import { verifyMfaAction } from "@/app/(auth)/actions";
import { INITIAL_AUTH_STATE } from "@/lib/auth/authState";

interface Props {
  next: string;
}

export function MfaChallenge({ next }: Props) {
  const [state, formAction, pending] = useActionState(verifyMfaAction, INITIAL_AUTH_STATE);
  const [code, setCode] = useState("");

  return (
    <div className="mx-auto w-full max-w-md">
      <p className="font-mono text-[10px] tracking-[0.22em] text-[var(--color-text-muted)] uppercase">
        // two-factor
      </p>
      <h1 className="mt-3 font-sans text-3xl font-medium text-[var(--color-text-primary)]">
        Enter your code
      </h1>
      <p className="mt-3 max-w-prose font-sans text-sm text-[var(--color-text-secondary)]">
        Open your authenticator app and enter the current 6-digit code.
      </p>

      <form action={formAction} className="mt-10 space-y-4">
        <input type="hidden" name="next" value={next} />
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="000000"
          aria-label="Authenticator code"
          className="h-12 w-48 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] px-3 text-center font-mono text-xl tracking-[0.4em] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-text-primary)]"
        />
        <button
          type="submit"
          disabled={pending || code.length !== 6}
          className="flex h-11 w-48 items-center justify-center rounded-md bg-[var(--color-text-primary)] font-mono text-xs tracking-[0.18em] text-[var(--color-canvas)] uppercase transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Verifying…" : "Verify"}
        </button>
        {state.error ? (
          <p role="alert" className="font-mono text-xs text-[var(--color-accent-red)]">
            // {state.error}
          </p>
        ) : null}
      </form>
    </div>
  );
}
