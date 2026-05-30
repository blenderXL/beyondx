"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { loginAction, signupAction } from "@/app/(auth)/actions";
import { INITIAL_AUTH_STATE } from "@/lib/auth/authState";
import { passwordChecks } from "@/lib/auth/passwordPolicy";

type Mode = "login" | "signup";

interface Props {
  mode: Mode;
  next?: string;
}

const SITE_URL =
  typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_SITE_URL ?? "");

const inputClass =
  "mt-2 block h-11 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] px-3 font-mono text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-text-primary)]";
const labelClass =
  "font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]";

export function AuthForm({ mode, next = "/app" }: Props) {
  const action = mode === "login" ? loginAction : signupAction;
  const [state, formAction, pending] = useActionState(action, INITIAL_AUTH_STATE);
  const [password, setPassword] = useState("");
  const [oauthPending, setOauthPending] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);

  async function handleGoogle() {
    setOauthPending(true);
    setOauthError(null);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${SITE_URL}/callback` },
    });
    if (error) {
      setOauthPending(false);
      setOauthError(error.message);
    }
    // On success the browser is redirected to Google; nothing else to do here.
  }

  const title = mode === "login" ? "Log in" : "Create account";
  const altMode = mode === "login" ? "signup" : "login";
  const altLabel = mode === "login" ? "Need an account? Sign up" : "Have an account? Log in";
  const submitLabel = mode === "login" ? "Log in" : "Create account";
  const busy = pending || oauthPending;
  const checks = passwordChecks(password);
  const signupDone = mode === "signup" && state.ok;

  return (
    <div className="mx-auto w-full max-w-md">
      <p className={labelClass}>// {mode === "login" ? "welcome back" : "join nzx"}</p>
      <h1 className="mt-3 font-sans text-3xl font-medium text-[var(--color-text-primary)]">
        {title}
      </h1>

      {signupDone ? (
        <p className="mt-10 font-mono text-sm text-[var(--color-accent-emerald)]">
          // Check your inbox to confirm your email, then log in.
        </p>
      ) : (
        <>
          <div className="mt-10 space-y-3">
            <button
              type="button"
              onClick={handleGoogle}
              disabled={busy}
              className="flex h-11 w-full items-center justify-center gap-3 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] font-mono text-xs tracking-[0.18em] text-[var(--color-text-primary)] uppercase transition-colors hover:border-[var(--color-text-primary)] disabled:opacity-60"
            >
              <GoogleIcon /> Continue with Google
            </button>
            {/* Apple sign-in placeholder — wired once Apple Developer credentials exist. */}
            <button
              type="button"
              disabled
              aria-disabled
              title="Apple Sign-In requires an Apple Developer account — coming soon"
              className="flex h-11 w-full items-center justify-center gap-3 rounded-md border border-dashed border-[var(--color-border-subtle)] bg-transparent font-mono text-xs tracking-[0.18em] text-[var(--color-text-muted)] uppercase"
            >
              <AppleIcon /> Continue with Apple · soon
            </button>
          </div>

          <div className="my-8 flex items-center gap-3 font-mono text-[10px] tracking-[0.22em] text-[var(--color-text-muted)] uppercase">
            <span aria-hidden className="h-px flex-1 bg-[var(--color-border-subtle)]" />
            or email
            <span aria-hidden className="h-px flex-1 bg-[var(--color-border-subtle)]" />
          </div>

          <form action={formAction} className="space-y-3">
            <input type="hidden" name="next" value={next} />
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
            <label className="block">
              <span className={labelClass}>Password</span>
              <input
                type="password"
                name="password"
                required
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                className={inputClass}
              />
            </label>

            {mode === "signup" ? (
              <>
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
              </>
            ) : null}

            {mode === "login" ? (
              <p className="pt-1 text-right">
                <Link
                  href="/forgot-password"
                  className="font-mono text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                >
                  Forgot password?
                </Link>
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="flex h-11 w-full items-center justify-center rounded-md bg-[var(--color-text-primary)] font-mono text-xs tracking-[0.18em] text-[var(--color-canvas)] uppercase transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Working…" : submitLabel}
            </button>
          </form>
        </>
      )}

      {(state.error || oauthError) && !signupDone ? (
        <p role="alert" className="mt-4 font-mono text-xs text-[var(--color-accent-red)]">
          // {state.error ?? oauthError}
        </p>
      ) : null}

      <p className="mt-10 font-mono text-xs text-[var(--color-text-muted)]">
        <Link href={`/${altMode}`} className="hover:text-[var(--color-text-primary)]">
          {altLabel}
        </Link>
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.4-1.6 4-5.5 4-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.4 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.9-.8-3.1-.8-1.6 0-3 .9-3.8 2.4-1.6 2.8-.4 6.9 1.2 9.1.8 1.1 1.7 2.4 2.9 2.3 1.2-.1 1.6-.8 3-.8s1.8.8 3 .7c1.3 0 2.1-1.1 2.9-2.3.9-1.3 1.3-2.6 1.3-2.7-.1 0-2.5-1-2.5-3.5zM14.3 5.7c.6-.8 1.1-1.9 1-3-1 .1-2.1.6-2.8 1.4-.6.7-1.2 1.8-1 2.9 1.1.1 2.2-.6 2.8-1.3z" />
    </svg>
  );
}
