"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { acceptLegal } from "@/app/(app)/app/legal/actions";
import { INITIAL_ACCEPT_STATE } from "@/lib/legal/acceptState";

/**
 * First-login legal acknowledgment gate. Rendered by the app layout when the signed-in user
 * hasn't accepted the current legal version. A non-dismissible, opaque, full-screen overlay
 * (no Escape / no backdrop close) so the app isn't usable until the user explicitly agrees.
 * On success it refreshes the route so the layout re-runs and the overlay unmounts.
 */
export function LegalConsentGate({ open }: { open: boolean }) {
  const [agreed, setAgreed] = useState(false);
  const [state, formAction, pending] = useActionState(acceptLegal, INITIAL_ACCEPT_STATE);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  if (!open) return null;

  const linkClass =
    "font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-secondary)] underline decoration-[var(--color-border-strong)] underline-offset-4 hover:text-[var(--color-text-primary)]";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-consent-title"
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-[var(--color-canvas)] p-4 sm:items-center"
    >
      <div className="my-8 w-full max-w-lg rounded-[var(--radius-card)] border border-[var(--color-border-strong)] bg-[var(--color-elevated)] p-6 sm:p-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--color-text-muted)]">
          // critical disclaimers — please read
        </p>
        <h2
          id="legal-consent-title"
          className="mt-3 font-sans text-2xl font-medium text-[var(--color-text-primary)]"
        >
          Before you continue
        </h2>

        <p className="mt-5 rounded-md border border-[var(--color-accent-amber)]/40 bg-[color-mix(in_oklab,var(--color-accent-amber),transparent_92%)] px-4 py-3 font-mono text-sm font-medium text-[var(--color-accent-amber)]">
          NZX is not financial advice.
        </p>

        <ul className="mt-4 space-y-2 pl-5 text-sm leading-relaxed text-[var(--color-text-secondary)]">
          <li className="list-disc">
            NZX and its AI Assistant are tools for personal tracking and planning only — not a
            substitute for a licensed financial professional.
          </li>
          <li className="list-disc">
            AI outputs can be inaccurate or misleading. Never make financial decisions based solely
            on NZX.
          </li>
          <li className="list-disc">
            You are fully responsible for your financial decisions, and you use NZX at your own risk.
          </li>
        </ul>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link href="/legal/terms" target="_blank" rel="noopener noreferrer" className={linkClass}>
            Terms
          </Link>
          <Link href="/legal/privacy" target="_blank" rel="noopener noreferrer" className={linkClass}>
            Privacy
          </Link>
          <Link href="/legal/disclaimer" target="_blank" rel="noopener noreferrer" className={linkClass}>
            Full disclaimer
          </Link>
        </div>

        <form action={formAction} className="mt-6">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              aria-label="I have read and agree"
              className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent-emerald)]"
            />
            <span className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
              I have read and agree to the{" "}
              <span className="text-[var(--color-text-primary)]">Terms of Service</span>,{" "}
              <span className="text-[var(--color-text-primary)]">Privacy Policy</span>, and{" "}
              <span className="text-[var(--color-text-primary)]">Disclaimer</span>.
            </span>
          </label>

          <button
            type="submit"
            disabled={!agreed || pending}
            className="mt-6 flex h-11 w-full items-center justify-center rounded-md bg-[var(--color-text-primary)] font-mono text-xs tracking-[0.18em] text-[var(--color-canvas)] uppercase transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {pending ? "Saving…" : "Agree & continue"}
          </button>

          {state.error ? (
            <p role="alert" className="mt-4 font-mono text-xs text-[var(--color-accent-red)]">
              // {state.error}
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}
