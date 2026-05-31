"use client";

import { useActionState, useState } from "react";
import { resetPasswordAction } from "@/app/(auth)/actions";
import { INITIAL_AUTH_STATE } from "@/lib/auth/authState";
import { passwordChecks } from "@/lib/auth/passwordPolicy";

const inputClass =
  "mt-2 block h-11 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] px-3 font-mono text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-text-primary)]";
const labelClass =
  "font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]";

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(resetPasswordAction, INITIAL_AUTH_STATE);
  const [password, setPassword] = useState("");
  const checks = passwordChecks(password);

  return (
    <div className="mx-auto w-full max-w-md">
      <p className={labelClass}>// set a new password</p>
      <h1 className="mt-3 font-sans text-3xl font-medium text-[var(--color-text-primary)]">
        New password
      </h1>

      <form action={formAction} className="mt-10 space-y-3">
        <label className="block">
          <span className={labelClass}>New password</span>
          <input
            type="password"
            name="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••"
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Confirm password</span>
          <input
            type="password"
            name="confirm"
            required
            autoComplete="new-password"
            placeholder="••••••••••"
            className={inputClass}
          />
        </label>
        <ul className="grid gap-1 pt-1" aria-label="Password requirements">
          {checks.map((check) => (
            <li
              key={check.label}
              className="flex items-center gap-2 font-mono text-[11px]"
              style={{
                color: check.ok ? "var(--color-accent-emerald)" : "var(--color-text-muted)",
              }}
            >
              <span aria-hidden>{check.ok ? "✓" : "·"}</span>
              {check.label}
            </li>
          ))}
        </ul>
        <button
          type="submit"
          disabled={pending}
          className="flex h-11 w-full items-center justify-center rounded-md bg-[var(--color-text-primary)] font-mono text-xs tracking-[0.18em] text-[var(--color-canvas)] uppercase transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Working…" : "Update password"}
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
