"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload } from "lucide-react";
import { exportPortfolio, importPortfolio } from "@/app/(app)/app/settings/actions";

const buttonClass =
  "inline-flex h-11 items-center gap-2 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] px-4 font-mono text-xs uppercase tracking-[0.18em] text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] disabled:opacity-50";

export function PortfolioControls() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function onExport() {
    setBusy(true);
    setMessage(null);
    const r = await exportPortfolio();
    setBusy(false);
    if (r.error || !r.json) {
      setIsError(true);
      setMessage(r.error ?? "Export failed.");
      return;
    }
    const url = URL.createObjectURL(new Blob([r.json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `nzx-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setIsError(false);
    setMessage("Backup downloaded.");
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMessage(null);
    const text = await file.text();
    const r = await importPortfolio(text);
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
    if (r.error) {
      setIsError(true);
      setMessage(r.error);
      return;
    }
    const c = r.counts!;
    setIsError(false);
    setMessage(
      `Restored ${c.debts} debts, ${c.incomes} incomes, ${c.expenses} expenses, ${c.savings_goals} pots, ${c.transactions} transactions.`,
    );
    router.refresh();
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-6">
      <p className="font-mono text-[10px] tracking-[0.22em] text-[var(--color-text-muted)] uppercase">
        // your data
      </p>
      <p className="mt-2 max-w-prose font-sans text-sm text-[var(--color-text-secondary)]">
        Download a full backup of your debts, income, expenses, savings, and history as a JSON file —
        or restore one into this account. Restoring adds the backup&apos;s items alongside anything
        already here.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" onClick={onExport} disabled={busy} className={buttonClass}>
          <Download className="size-4" aria-hidden />
          Export backup
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className={buttonClass}
        >
          <Upload className="size-4" aria-hidden />
          Import backup
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={onImportFile}
          aria-label="Import backup file"
          className="hidden"
        />
      </div>
      {message ? (
        <p
          role="status"
          className="mt-4 font-mono text-[11px]"
          style={{ color: isError ? "var(--color-accent-red)" : "var(--color-accent-emerald)" }}
        >
          // {message}
        </p>
      ) : null}
    </div>
  );
}
