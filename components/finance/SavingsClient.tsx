"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { StatCard } from "@/components/layout/StatCard";
import { createSavingsGoal, updateSavingsGoal, archiveSavingsGoal } from "@/app/(app)/actions";
import { INITIAL_FINANCE_STATE } from "@/lib/finance/actionState";
import type { SavingsGoal } from "@/lib/finance/types";
import { formatUsd } from "@/lib/finance/derive";
import { FieldHint } from "@/components/finance/FieldHint";
import { SAVINGS_HINTS } from "@/lib/finance/fieldHints";
import {
  inputClass,
  labelClass,
  primaryButtonClass,
  ghostButtonClass,
  errorClass,
} from "@/components/finance/formStyles";

function potProgress(g: SavingsGoal): number | null {
  if (g.target_amount === null || Number(g.target_amount) <= 0) return null;
  return Math.max(0, Math.min(1, Number(g.current_amount) / Number(g.target_amount)));
}

function SavingsForm({ goal, onDone, onCancel }: { goal?: SavingsGoal; onDone: () => void; onCancel: () => void }) {
  const editing = Boolean(goal);
  const [state, formAction, pending] = useActionState(
    editing ? updateSavingsGoal : createSavingsGoal,
    INITIAL_FINANCE_STATE,
  );
  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form
      action={formAction}
      className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-6"
    >
      <p className={labelClass}>// {editing ? "edit pot" : "new pot"}</p>
      <h2 className="mt-2 mb-6 font-sans text-xl font-medium text-[var(--color-text-primary)]">
        {editing ? goal!.name : "Add a savings pot"}
      </h2>
      {editing ? <input type="hidden" name="id" value={goal!.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className={labelClass}>
            Name
            <FieldHint text={SAVINGS_HINTS.name} label="name" />
          </span>
          <input
            type="text"
            name="name"
            aria-label="Name"
            required
            maxLength={120}
            defaultValue={goal?.name}
            placeholder="Purge, Emergency fund…"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className={labelClass}>
            Current amount
            <FieldHint text={SAVINGS_HINTS.current_amount} label="current amount" />
          </span>
          <input
            type="text"
            inputMode="decimal"
            name="current_amount"
            aria-label="Current amount"
            defaultValue={goal?.current_amount ?? ""}
            placeholder="0.00"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className={labelClass}>
            Target (optional)
            <FieldHint text={SAVINGS_HINTS.target_amount} label="target" />
          </span>
          <input
            type="text"
            inputMode="decimal"
            name="target_amount"
            aria-label="Target"
            defaultValue={goal?.target_amount ?? ""}
            placeholder="0.00"
            className={inputClass}
          />
        </label>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? "Saving…" : editing ? "Save pot" : "Add pot"}
        </button>
        <button type="button" onClick={onCancel} className={ghostButtonClass}>
          Cancel
        </button>
      </div>

      {state.error ? (
        <p role="alert" className={`mt-4 ${errorClass}`}>
          // {state.error}
        </p>
      ) : null}
    </form>
  );
}

type Mode = { kind: "list" } | { kind: "create" } | { kind: "edit"; goal: SavingsGoal };

export function SavingsClient({ goals }: { goals: SavingsGoal[] }) {
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const toList = useCallback(() => setMode({ kind: "list" }), []);
  const total = goals.reduce((sum, g) => sum + Number(g.current_amount), 0);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className={labelClass}>// savings</p>
          <h1 className="mt-2 font-sans text-3xl font-medium text-[var(--color-text-primary)]">
            Your savings pots
          </h1>
        </div>
        {mode.kind === "list" ? (
          <button onClick={() => setMode({ kind: "create" })} className={primaryButtonClass}>
            New pot
          </button>
        ) : null}
      </header>

      {mode.kind === "create" ? <SavingsForm onDone={toList} onCancel={toList} /> : null}
      {mode.kind === "edit" ? <SavingsForm goal={mode.goal} onDone={toList} onCancel={toList} /> : null}

      {mode.kind === "list" ? (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-2">
            <StatCard label="Pots" value={String(goals.length)} accentVar="--color-accent-emerald" />
            <StatCard label="Total saved" value={formatUsd(total)} accentVar="--color-accent-blue" />
          </div>

          {goals.length === 0 ? (
            <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-strong)] p-10 text-center">
              <p className="font-mono text-sm text-[var(--color-text-muted)]">
                // no pots yet — create one (like &quot;Purge&quot;) to start saving
              </p>
            </div>
          ) : (
            <ul aria-label="Savings pots" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {goals.map((goal) => {
                const progress = potProgress(goal);
                return (
                  <li
                    key={goal.id}
                    className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-sans text-base font-medium text-[var(--color-text-primary)]">{goal.name}</p>
                      <p className="font-sans text-2xl font-medium text-[var(--color-text-primary)] tabular-nums">
                        {formatUsd(Number(goal.current_amount))}
                      </p>
                    </div>
                    {goal.target_amount !== null ? (
                      <p className="mt-1 font-mono text-[11px] text-[var(--color-text-muted)]">
                        target {formatUsd(Number(goal.target_amount))}
                      </p>
                    ) : null}
                    {progress !== null ? (
                      <div className="mt-4">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-elevated)]">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${Math.round(progress * 100)}%`, background: "var(--color-accent-emerald)" }}
                          />
                        </div>
                        <p className="mt-1 font-mono text-[10px] text-[var(--color-text-muted)]">
                          {Math.round(progress * 100)}% of target
                        </p>
                      </div>
                    ) : null}
                    <div className="mt-5 flex flex-wrap items-center gap-2">
                      <button onClick={() => setMode({ kind: "edit", goal })} className={ghostButtonClass}>
                        Edit
                      </button>
                      <ArchiveButton id={goal.id} name={goal.name} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : null}
    </div>
  );
}

function ArchiveButton({ id, name }: { id: string; name: string }) {
  const [state, formAction] = useActionState(archiveSavingsGoal, INITIAL_FINANCE_STATE);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(`Archive "${name}"? It'll be hidden from your pots.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="flex h-11 items-center justify-center rounded-md px-4 font-mono text-xs tracking-[0.18em] text-[var(--color-text-muted)] uppercase transition-colors hover:text-[var(--color-accent-red)]"
      >
        Archive
      </button>
      {state.error ? <span role="alert" className={`ml-2 ${errorClass}`}>{state.error}</span> : null}
    </form>
  );
}
