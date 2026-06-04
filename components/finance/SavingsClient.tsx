"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { StatCard } from "@/components/layout/StatCard";
import { createSavingsGoal, updateSavingsGoal, archiveSavingsGoal, addContribution } from "@/app/(app)/actions";
import { INITIAL_FINANCE_STATE } from "@/lib/finance/actionState";
import { SAVINGS_TYPES, SAVINGS_TYPE_LABELS, type SavingsGoal } from "@/lib/finance/types";
import { formatUsd } from "@/lib/finance/derive";
import { SparkArea } from "@/components/finance/charts";
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
            Type
            <FieldHint text={SAVINGS_HINTS.type} label="savings type" />
          </span>
          <select name="type" aria-label="Type" defaultValue={goal?.type ?? "general"} className={inputClass}>
            {SAVINGS_TYPES.map((t) => (
              <option key={t} value={t}>
                {SAVINGS_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
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

type Mode =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "edit"; goal: SavingsGoal }
  | { kind: "contribute"; goal: SavingsGoal };

export function SavingsClient({
  goals,
  trajectory = [],
  months = [],
}: {
  goals: SavingsGoal[];
  trajectory?: number[];
  months?: string[];
}) {
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const toList = useCallback(() => setMode({ kind: "list" }), []);
  const total = goals.reduce((sum, g) => sum + Number(g.current_amount), 0);
  const hasTrajectory = trajectory.some((v) => v > 0);

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
      {mode.kind === "contribute" ? (
        <ContributionForm goal={mode.goal} onDone={toList} onCancel={toList} />
      ) : null}

      {mode.kind === "list" ? (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-2">
            <StatCard label="Pots" value={String(goals.length)} accentVar="--color-accent-emerald" />
            <StatCard label="Total saved" value={formatUsd(total)} accentVar="--color-accent-blue" />
          </div>

          {hasTrajectory ? (
            <section className="mb-8 rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5">
              <div className="flex items-baseline justify-between gap-4">
                <p className={labelClass}>// savings trajectory</p>
                <p className="font-mono text-[10px] tracking-[0.18em] text-[var(--color-text-muted)] uppercase">
                  {months.length > 0 ? `${months[0]} → ${months[months.length - 1]}` : ""}
                </p>
              </div>
              <div className="mt-3">
                <SparkArea values={trajectory} accentVar="--color-accent-emerald" />
              </div>
            </section>
          ) : null}

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
                      <div className="min-w-0">
                        <p className="font-sans text-base font-medium text-[var(--color-text-primary)]">{goal.name}</p>
                        <span className="mt-1 inline-block rounded-full border border-[var(--color-border-strong)] bg-[var(--color-elevated)] px-2 py-0.5 font-mono text-[10px] tracking-[0.14em] text-[var(--color-text-muted)] uppercase">
                          {SAVINGS_TYPE_LABELS[goal.type ?? "general"]}
                        </span>
                      </div>
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
                      <button onClick={() => setMode({ kind: "contribute", goal })} className={primaryButtonClass}>
                        Contribute
                      </button>
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

/** Record a deposit into one pot — bumps its balance and feeds the trajectory. */
function ContributionForm({ goal, onDone, onCancel }: { goal: SavingsGoal; onDone: () => void; onCancel: () => void }) {
  const [state, formAction, pending] = useActionState(addContribution, INITIAL_FINANCE_STATE);
  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form
      action={formAction}
      className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-6"
    >
      <p className={labelClass}>// add contribution</p>
      <h2 className="mt-2 mb-1 font-sans text-xl font-medium text-[var(--color-text-primary)]">{goal.name}</h2>
      <p className="mb-6 font-mono text-[11px] text-[var(--color-text-muted)]">
        // current {formatUsd(Number(goal.current_amount))}
      </p>

      <input type="hidden" name="savings_goal_id" value={goal.id} />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Amount</span>
          <input
            type="text"
            inputMode="decimal"
            name="amount"
            aria-label="Contribution amount"
            required
            placeholder="0.00"
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Date</span>
          <input type="date" name="occurred_on" aria-label="Contribution date" className={inputClass} />
        </label>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? "Recording…" : "Record contribution"}
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
