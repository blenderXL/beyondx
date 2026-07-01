"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { resetAccount } from "@/app/(app)/app/settings/actions";

// Must match RESET_CONFIRM_PHRASE in the server action (kept as a local literal because a
// "use server" module can't export a plain constant).
const CONFIRM_PHRASE = "RESET";

/**
 * Reset all entered data while keeping the account. Two guards: the user types the confirm
 * phrase (button stays disabled until it matches), then confirms a native dialog. On success
 * the server revalidates every signed-in page; we also refresh the router so the cleared state
 * shows immediately.
 */
export function ResetAccount() {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const matches = value.trim().toUpperCase() === CONFIRM_PHRASE;

  async function onReset() {
    if (!matches) return;
    if (
      !window.confirm(
        "Erase ALL your debts, incomes, expenses, savings, cards, and history? Your account stays, but this can't be undone.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    const r = await resetAccount(value);
    setBusy(false);
    if (r?.error) {
      setError(r.error);
      return;
    }
    setValue("");
    setDone(true);
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-accent-amber)]/40 bg-[var(--color-surface)] p-6">
      <p className="font-mono text-[10px] tracking-[0.22em] text-[var(--color-accent-amber)] uppercase">
        // reset data
      </p>
      <p className="mt-2 max-w-prose font-sans text-sm text-[var(--color-text-secondary)]">
        Start fresh: permanently clears every debt, income, expense, savings pot, payment card,
        transaction, plan, and your payoff budget. Your account, login, and settings are kept.
        Export a backup first if you might want it back.
      </p>
      <label className="mt-5 block">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
          Type <span className="text-[var(--color-text-secondary)]">{CONFIRM_PHRASE}</span> to confirm
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setDone(false);
          }}
          aria-label="Type RESET to confirm clearing your data"
          autoComplete="off"
          className="mt-2 block h-11 w-full max-w-md rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] px-3 font-mono text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent-amber)]"
        />
      </label>
      <button
        type="button"
        onClick={onReset}
        disabled={!matches || busy}
        className="mt-4 inline-flex h-11 items-center gap-2 rounded-md border border-[var(--color-accent-amber)] px-4 font-mono text-xs uppercase tracking-[0.18em] text-[var(--color-accent-amber)] transition-colors hover:bg-[var(--color-accent-amber)] hover:text-[var(--color-canvas)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[var(--color-accent-amber)]"
      >
        <RotateCcw className="size-4" aria-hidden />
        {busy ? "Clearing…" : "Reset my data"}
      </button>
      {error ? (
        <p role="alert" className="mt-3 font-mono text-[11px] text-[var(--color-accent-red)]">
          // {error}
        </p>
      ) : null}
      {done ? (
        <p role="status" className="mt-3 font-mono text-[11px] text-[var(--color-accent-emerald)]">
          // your data has been cleared
        </p>
      ) : null}
    </div>
  );
}
