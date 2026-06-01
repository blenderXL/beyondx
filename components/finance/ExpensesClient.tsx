"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { StatCard } from "@/components/layout/StatCard";
import { createExpense, updateExpense, archiveExpense } from "@/app/(app)/actions";
import { INITIAL_FINANCE_STATE } from "@/lib/finance/actionState";
import {
  EXPENSE_CADENCES,
  EXPENSE_CADENCE_LABELS,
  EXPENSE_GROUPS,
  EXPENSE_GROUP_LABELS,
  type Expense,
} from "@/lib/finance/types";
import { formatUsd } from "@/lib/finance/derive";
import {
  inputClass,
  labelClass,
  primaryButtonClass,
  ghostButtonClass,
  errorClass,
} from "@/components/finance/formStyles";

function ExpenseForm({ expense, onDone, onCancel }: { expense?: Expense; onDone: () => void; onCancel: () => void }) {
  const editing = Boolean(expense);
  const [state, formAction, pending] = useActionState(
    editing ? updateExpense : createExpense,
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
      <p className={labelClass}>// {editing ? "edit expense" : "new expense"}</p>
      <h2 className="mt-2 mb-6 font-sans text-xl font-medium text-[var(--color-text-primary)]">
        {editing ? expense!.category : "Add an expense"}
      </h2>
      {editing ? <input type="hidden" name="id" value={expense!.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className={labelClass}>Name</span>
          <input
            type="text"
            name="category"
            required
            maxLength={120}
            defaultValue={expense?.category}
            placeholder="Internet, Electricity, HOA…"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className={labelClass}>Group</span>
          <select name="expense_group" aria-label="Group" defaultValue={expense?.expense_group ?? ""} className={inputClass}>
            <option value="">—</option>
            {EXPENSE_GROUPS.map((g) => (
              <option key={g} value={g}>
                {EXPENSE_GROUP_LABELS[g]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={labelClass}>Payee</span>
          <input
            type="text"
            name="payee"
            maxLength={120}
            defaultValue={expense?.payee ?? ""}
            placeholder="Optimum, CoServ…"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className={labelClass}>Amount</span>
          <input
            type="text"
            inputMode="decimal"
            name="amount"
            required
            defaultValue={expense?.amount ?? ""}
            placeholder="0.00"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className={labelClass}>Frequency</span>
          <select name="cadence" aria-label="Frequency" defaultValue={expense?.cadence ?? "monthly"} className={inputClass}>
            {EXPENSE_CADENCES.map((c) => (
              <option key={c} value={c}>
                {EXPENSE_CADENCE_LABELS[c]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={labelClass}>Due day (1–31)</span>
          <input
            type="number"
            name="due_day"
            min={1}
            max={31}
            step={1}
            defaultValue={expense?.due_day ?? ""}
            placeholder="1–31"
            className={inputClass}
          />
        </label>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? "Saving…" : editing ? "Save expense" : "Add expense"}
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

type Mode = { kind: "list" } | { kind: "create" } | { kind: "edit"; expense: Expense };

export function ExpensesClient({ expenses }: { expenses: Expense[] }) {
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const toList = useCallback(() => setMode({ kind: "list" }), []);
  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className={labelClass}>// expenses</p>
          <h1 className="mt-2 font-sans text-3xl font-medium text-[var(--color-text-primary)]">
            Your expenses
          </h1>
        </div>
        {mode.kind === "list" ? (
          <button onClick={() => setMode({ kind: "create" })} className={primaryButtonClass}>
            New expense
          </button>
        ) : null}
      </header>

      {mode.kind === "create" ? <ExpenseForm onDone={toList} onCancel={toList} /> : null}
      {mode.kind === "edit" ? <ExpenseForm expense={mode.expense} onDone={toList} onCancel={toList} /> : null}

      {mode.kind === "list" ? (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-2">
            <StatCard label="Expenses tracked" value={String(expenses.length)} accentVar="--color-accent-blue" />
            <StatCard label="Listed total" value={formatUsd(total)} hint="raw, per their cadence" accentVar="--color-accent-amber" />
          </div>

          {expenses.length === 0 ? (
            <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-strong)] p-10 text-center">
              <p className="font-mono text-sm text-[var(--color-text-muted)]">
                // no expenses yet — add your bills to start planning
              </p>
            </div>
          ) : (
            <ul aria-label="Expenses" className="grid gap-4 lg:grid-cols-2">
              {expenses.map((expense) => (
                <li
                  key={expense.id}
                  className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-sans text-base font-medium text-[var(--color-text-primary)]">
                        {expense.category}
                      </p>
                      <p className="mt-1 font-mono text-[11px] tracking-[0.18em] text-[var(--color-text-muted)] uppercase">
                        {expense.expense_group ? EXPENSE_GROUP_LABELS[expense.expense_group] : "Ungrouped"}
                        {expense.payee ? ` · ${expense.payee}` : ""}
                      </p>
                    </div>
                    <p className="font-sans text-2xl font-medium text-[var(--color-text-primary)] tabular-nums">
                      {formatUsd(Number(expense.amount))}
                    </p>
                  </div>
                  <p className="mt-3 font-mono text-[11px] text-[var(--color-text-secondary)]">
                    {EXPENSE_CADENCE_LABELS[expense.cadence]}
                    {expense.due_day ? ` · due day ${expense.due_day}` : ""}
                  </p>
                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <button onClick={() => setMode({ kind: "edit", expense })} className={ghostButtonClass}>
                      Edit
                    </button>
                    <ArchiveButton id={expense.id} name={expense.category} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </div>
  );
}

function ArchiveButton({ id, name }: { id: string; name: string }) {
  const [state, formAction] = useActionState(archiveExpense, INITIAL_FINANCE_STATE);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(`Archive "${name}"? It'll be hidden from your expenses.`)) e.preventDefault();
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
