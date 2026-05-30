"use client";

import { useActionState } from "react";
import Link from "next/link";
import { forgotPasswordAction } from "@/app/(auth)/actions";
import { INITIAL_AUTH_STATE } from "@/lib/auth/authState";

const inputClass =
  "mt-2 block h-11 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] px-3 font-mono text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-text-primary)]";
const labelClass =
  "font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, INITIAL_AUTH_STATE);

  return (
    <div className="mx-auto w-full max-w-md">
      <p className={labelClass}>// reset password</p>
      <h1 className="mt-3 font-sans text-3xl font-medium text-[var(--color-text-primary)]">
        Forgot password
      </h1>

      {state.ok ? (
        <p className="mt-10 font-mono text-sm text-[var(--color-accent-emerald)]">
          // If that address has an account, a reset link is on its way.
        </p>
      ) : (
        <form action={formAction} className="mt-10 space-y-3">
          <label className="block">
            <span className={labelClass}>Email</span>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              className={inputClass}
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="flex h-11 w-full items-center justify-center rounded-md bg-[var(--color-text-primary)] font-mono text-xs tracking-[0.18em] text-[var(--color-canvas)] uppercase transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Working…" : "Send reset link"}
          </button>
          {state.error ? (
            <p role="alert" className="font-mono text-xs text-[var(--color-accent-red)]">
              // {state.error}
            </p>
          ) : null}
        </form>
      )}

      <p className="mt-10 font-mono text-xs text-[var(--color-text-muted)]">
        <Link href="/login" className="hover:text-[var(--color-text-primary)]">
          Back to log in
        </Link>
      </p>
    </div>
  );
}
