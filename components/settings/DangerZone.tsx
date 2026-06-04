"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteAccount } from "@/app/(app)/app/settings/actions";

/**
 * Permanent account deletion. Two guards before the destructive call: the user must retype
 * their exact email (button stays disabled until it matches), then confirm a native dialog.
 * On success the server action signs out + redirects, so control never returns here.
 */
export function DangerZone({ email }: { email: string }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = value.trim().toLowerCase() === email.toLowerCase();

  async function onDelete() {
    if (!matches) return;
    if (!window.confirm("Permanently delete your account and ALL of your data? This cannot be undone.")) {
      return;
    }
    setBusy(true);
    setError(null);
    const r = await deleteAccount(value);
    // Success redirects (control won't return); a returned object means it failed.
    setBusy(false);
    if (r?.error) setError(r.error);
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-accent-red)]/40 bg-[var(--color-surface)] p-6">
      <p className="font-mono text-[10px] tracking-[0.22em] text-[var(--color-accent-red)] uppercase">
        // danger zone
      </p>
      <p className="mt-2 max-w-prose font-sans text-sm text-[var(--color-text-secondary)]">
        Deleting your account permanently removes your profile and every debt, income, expense,
        savings pot, and transaction. Export a backup first if you might want to restore later.
      </p>
      <label className="mt-5 block">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
          Type <span className="text-[var(--color-text-secondary)]">{email}</span> to confirm
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Confirm your email to delete the account"
          autoComplete="off"
          className="mt-2 block h-11 w-full max-w-md rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] px-3 font-mono text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent-red)]"
        />
      </label>
      <button
        type="button"
        onClick={onDelete}
        disabled={!matches || busy}
        className="mt-4 inline-flex h-11 items-center gap-2 rounded-md border border-[var(--color-accent-red)] px-4 font-mono text-xs uppercase tracking-[0.18em] text-[var(--color-accent-red)] transition-colors hover:bg-[var(--color-accent-red)] hover:text-[var(--color-canvas)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[var(--color-accent-red)]"
      >
        <Trash2 className="size-4" aria-hidden />
        {busy ? "Deleting…" : "Delete my account"}
      </button>
      {error ? (
        <p role="alert" className="mt-3 font-mono text-[11px] text-[var(--color-accent-red)]">
          // {error}
        </p>
      ) : null}
    </div>
  );
}
