"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Mode = "login" | "signup";

interface Props {
  mode: Mode;
}

const SITE_URL =
  typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL ?? "";

export function AuthForm({ mode }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleMagicLink(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg(null);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${SITE_URL}/callback`,
        shouldCreateUser: true,
      },
    });
    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
      return;
    }
    setStatus("sent");
  }

  async function handleGoogle() {
    setStatus("submitting");
    setErrorMsg(null);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${SITE_URL}/callback` },
    });
    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
    }
    // OAuth handles redirect; router.push not needed here.
  }

  const title = mode === "login" ? "Log in" : "Create account";
  const altMode = mode === "login" ? "signup" : "login";
  const altLabel = mode === "login" ? "Need an account? Sign up" : "Have an account? Log in";

  return (
    <div className="mx-auto w-full max-w-md">
      <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--color-text-muted)]">
        // {mode === "login" ? "welcome back" : "join nzx"}
      </p>
      <h1 className="mt-3 font-sans text-3xl font-medium text-[var(--color-text-primary)]">
        {title}
      </h1>

      <div className="mt-10 space-y-3">
        <button
          type="button"
          onClick={handleGoogle}
          disabled={status === "submitting"}
          className="flex h-11 w-full items-center justify-center gap-3 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] font-mono text-xs uppercase tracking-[0.18em] text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-text-primary)] disabled:opacity-60"
        >
          <GoogleIcon /> Continue with Google
        </button>
        {/* Apple sign-in placeholder — wired once Apple Developer credentials exist. */}
        <button
          type="button"
          disabled
          aria-disabled
          title="Apple Sign-In requires an Apple Developer account — coming in v1.0.1"
          className="flex h-11 w-full items-center justify-center gap-3 rounded-md border border-dashed border-[var(--color-border-subtle)] bg-transparent font-mono text-xs uppercase tracking-[0.18em] text-[var(--color-text-muted)]"
        >
          <AppleIcon /> Continue with Apple · soon
        </button>
      </div>

      <div className="my-8 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
        <span aria-hidden className="h-px flex-1 bg-[var(--color-border-subtle)]" />
        or email
        <span aria-hidden className="h-px flex-1 bg-[var(--color-border-subtle)]" />
      </div>

      <form onSubmit={handleMagicLink} className="space-y-3">
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
            Email
          </span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-2 block h-11 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] px-3 font-mono text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-text-primary)]"
          />
        </label>
        <button
          type="submit"
          disabled={status === "submitting" || status === "sent"}
          className="flex h-11 w-full items-center justify-center rounded-md bg-[var(--color-text-primary)] font-mono text-xs uppercase tracking-[0.18em] text-[var(--color-canvas)] transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {status === "sent" ? "Check your inbox" : status === "submitting" ? "Sending…" : "Send magic link"}
        </button>
      </form>

      {status === "sent" ? (
        <p className="mt-4 font-mono text-xs text-[var(--color-accent-emerald)]">
          // Magic link sent. Click the link in your inbox to continue.
        </p>
      ) : null}
      {status === "error" && errorMsg ? (
        <p role="alert" className="mt-4 font-mono text-xs text-[var(--color-accent-red)]">
          // {errorMsg}
        </p>
      ) : null}

      <p className="mt-10 font-mono text-xs text-[var(--color-text-muted)]">
        <Link href={`/${altMode}`} className="hover:text-[var(--color-text-primary)]">
          {altLabel}
        </Link>
      </p>
    </div>
  );

  // suppress unused warning while router import is present for future redirects
  void router;
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
