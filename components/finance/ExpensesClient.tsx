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
  type ExpenseGroup,
  type DebtType,
} from "@/lib/finance/types";
import { formatUsd, expenseDisplayAmount } from "@/lib/finance/derive";
import { BarList } from "@/components/finance/charts";
import { FieldHint } from "@/components/finance/FieldHint";
import { EXPENSE_HINTS } from "@/lib/finance/fieldHints";
import {
  inputClass,
  labelClass,
  primaryButtonClass,
  ghostButtonClass,
  errorClass,
} from "@/components/finance/formStyles";

/** Minimal debt shape the expense form needs for the "Pay toward a debt" prefill. */
export interface DebtOption {
  id: string;
  name: string;
  type: DebtType;
  min_payment: number;
}

/** Server-computed summary for the right rail. */
export interface ExpensesRail {
  byGroup: { group: string; amount: number }[];
  subscriptionCount: number;
  subscriptionTotal: number;
}

/** A debt payment is grouped by what kind of debt it is. */
function debtExpenseGroup(type: DebtType): ExpenseGroup {
  if (type === "credit_card") return "credit_card";
  if (type === "mortgage" || type === "home_equity") return "housing";
  return "loan";
}

function ExpenseForm({
  expense,
  debts,
  onDone,
  onCancel,
}: {
  expense?: Expense;
  debts: DebtOption[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const editing = Boolean(expense);
  const hasDebts = debts.length > 0;
  const [state, formAction, pending] = useActionState(
    editing ? updateExpense : createExpense,
    INITIAL_FINANCE_STATE,
  );
  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  // First decision: is this a debt payment or a plain expense? Controlled fields let a debt
  // pick prefill name / group / amount (all still editable).
  const [kind, setKind] = useState<"debt" | "other">(expense?.debt_id ? "debt" : "other");
  const [debtId, setDebtId] = useState(expense?.debt_id ?? "");
  const [category, setCategory] = useState(expense?.category ?? "");
  const [group, setGroup] = useState<string>(expense?.expense_group ?? "");
  const [amount, setAmount] = useState(expense?.amount != null ? String(expense.amount) : "");
  // New offerings default to percent (tithe is usually a % of income); when editing, follow
  // whatever the saved expense uses.
  const [offeringMode, setOfferingMode] = useState<"fixed" | "percent">(
    expense ? (expense.pct_of_income != null ? "percent" : "fixed") : "percent",
  );
  const [pct, setPct] = useState(expense?.pct_of_income != null ? String(expense.pct_of_income) : "");

  function pickDebt(id: string) {
    setDebtId(id);
    const d = debts.find((x) => x.id === id);
    if (d) {
      setCategory(d.name);
      setGroup(debtExpenseGroup(d.type));
      setAmount(String(d.min_payment));
    }
  }

  const isOffering = kind === "other" && group === "offering";
  const isPercentOffering = isOffering && offeringMode === "percent";

  return (
    <form
      action={formAction}
      className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-6"
    >
      <p className={labelClass}>// {editing ? "edit expense" : "new expense"}</p>
      <h2 className="mt-2 mb-5 font-sans text-xl font-medium text-[var(--color-text-primary)]">
        {editing ? expense!.category : "Add an expense"}
      </h2>
      {editing ? <input type="hidden" name="id" value={expense!.id} /> : null}

      {/* First choice: pay toward a debt, or a plain expense. */}
      <div role="group" aria-label="Expense kind" className="mb-6 inline-flex rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] p-0.5">
        {(
          [
            { v: "debt" as const, label: "Pay toward a debt" },
            { v: "other" as const, label: "Other expense" },
          ]
        ).map(({ v, label }) => (
          <button
            key={v}
            type="button"
            onClick={() => setKind(v)}
            aria-pressed={kind === v}
            disabled={v === "debt" && !hasDebts}
            className={`rounded px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors disabled:opacity-40 ${
              kind === v
                ? "bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Carried hidden so the server gets the link + (for offerings) the percent. */}
      <input type="hidden" name="debt_id" value={kind === "debt" ? debtId : ""} />

      <div className="grid gap-4 sm:grid-cols-2">
        {kind === "debt" ? (
          <label className="block sm:col-span-2">
            <span className={labelClass}>
              Which debt?
              <FieldHint text={EXPENSE_HINTS.debt_id} label="debt" />
            </span>
            <select
              aria-label="Which debt"
              value={debtId}
              onChange={(e) => pickDebt(e.target.value)}
              className={inputClass}
            >
              <option value="">— Choose a debt —</option>
              {debts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <span className="mt-1 block font-mono text-[10px] text-[var(--color-text-muted)]">
              Prefills the name, group, and minimum — all editable. Marking it paid in the Budget draws
              the balance down.
            </span>
          </label>
        ) : null}

        <label className="block sm:col-span-2">
          <span className={labelClass}>
            Name
            <FieldHint text={EXPENSE_HINTS.category} label="name" />
          </span>
          <input
            type="text"
            name="category"
            aria-label="Name"
            required
            maxLength={120}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Internet, Electricity, HOA…"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className={labelClass}>
            Group
            <FieldHint text={EXPENSE_HINTS.group} label="group" />
          </span>
          <select
            name="expense_group"
            aria-label="Group"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            className={inputClass}
          >
            <option value="">—</option>
            {EXPENSE_GROUPS.map((g) => (
              <option key={g} value={g}>
                {EXPENSE_GROUP_LABELS[g]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={labelClass}>
            Payee
            <FieldHint text={EXPENSE_HINTS.payee} label="payee" />
          </span>
          <input
            type="text"
            name="payee"
            aria-label="Payee"
            maxLength={120}
            defaultValue={expense?.payee ?? ""}
            placeholder="Optimum, CoServ…"
            className={inputClass}
          />
        </label>

        {isOffering ? (
          <label className="block">
            <span className={labelClass}>
              Offering
              <FieldHint text={EXPENSE_HINTS.amount} label="offering" />
            </span>
            <div className="mt-2 mb-2 inline-flex rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] p-0.5">
              {(
                [
                  { v: "percent" as const, label: "% of income" },
                  { v: "fixed" as const, label: "Fixed $" },
                ]
              ).map(({ v, label }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setOfferingMode(v)}
                  aria-pressed={offeringMode === v}
                  className={`rounded px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] ${
                    offeringMode === v
                      ? "bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {isPercentOffering ? (
              <>
                <input
                  type="text"
                  inputMode="decimal"
                  name="pct_of_income"
                  aria-label="Offering percent of income"
                  value={pct}
                  onChange={(e) => setPct(e.target.value)}
                  placeholder="10"
                  className={inputClass}
                />
                {/* amount is required by the validator; a percent offering carries 0. */}
                <input type="hidden" name="amount" value="0" />
              </>
            ) : (
              <input
                type="text"
                inputMode="decimal"
                name="amount"
                aria-label="Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className={inputClass}
              />
            )}
          </label>
        ) : (
          <label className="block">
            <span className={labelClass}>
              Amount
              <FieldHint text={EXPENSE_HINTS.amount} label="amount" />
            </span>
            <input
              type="text"
              inputMode="decimal"
              name="amount"
              aria-label="Amount"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className={inputClass}
            />
          </label>
        )}

        <label className="block">
          <span className={labelClass}>
            Frequency
            <FieldHint text={EXPENSE_HINTS.cadence} label="frequency" />
          </span>
          <select name="cadence" aria-label="Frequency" defaultValue={expense?.cadence ?? "monthly"} className={inputClass}>
            {EXPENSE_CADENCES.map((c) => (
              <option key={c} value={c}>
                {EXPENSE_CADENCE_LABELS[c]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={labelClass}>
            Pay day (1–31)
            <FieldHint text={EXPENSE_HINTS.pay_day} label="pay day" />
          </span>
          <input
            type="number"
            name="due_day"
            aria-label="Pay day (1–31)"
            min={1}
            max={31}
            step={1}
            defaultValue={expense?.due_day ?? ""}
            placeholder="1–31"
            className={inputClass}
          />
          <span className="mt-1 block font-mono text-[10px] text-[var(--color-text-muted)]">
            The day this month you plan to pay it.
          </span>
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

export function ExpensesClient({
  expenses,
  debts,
  rail,
  income,
}: {
  expenses: Expense[];
  debts: DebtOption[];
  rail: ExpensesRail;
  /** Monthly income — resolves a percent offering to its dollar value in the listed total. */
  income: number;
}) {
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const toList = useCallback(() => setMode({ kind: "list" }), []);
  const total = expenses.reduce((sum, e) => sum + expenseDisplayAmount(e, income), 0);

  return (
    <div className="mx-auto max-w-6xl">
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

      {mode.kind === "create" ? <ExpenseForm debts={debts} onDone={toList} onCancel={toList} /> : null}
      {mode.kind === "edit" ? (
        <ExpenseForm expense={mode.expense} debts={debts} onDone={toList} onCancel={toList} />
      ) : null}

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
            <div className="lg:grid lg:grid-cols-[1fr_17rem] lg:items-start lg:gap-6">
              <ul aria-label="Expenses" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {expenses.map((expense) => {
                  const isOffering = expense.expense_group === "offering";
                  const displayAmount =
                    isOffering && expense.pct_of_income != null
                      ? `${expense.pct_of_income}% of income`
                      : formatUsd(Number(expense.amount));
                  return (
                    <li
                      key={expense.id}
                      className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-sans text-sm font-medium break-words text-[var(--color-text-primary)]">
                            {expense.category}
                          </p>
                          <p className="mt-0.5 font-mono text-[10px] tracking-[0.16em] break-words text-[var(--color-text-muted)] uppercase">
                            {expense.expense_group ? EXPENSE_GROUP_LABELS[expense.expense_group] : "Ungrouped"}
                            {expense.payee ? ` · ${expense.payee}` : ""}
                          </p>
                        </div>
                        <p className="shrink-0 font-sans text-lg font-medium text-[var(--color-text-primary)] tabular-nums">
                          {displayAmount}
                        </p>
                      </div>
                      <p className="mt-2 font-mono text-[11px] text-[var(--color-text-secondary)]">
                        {EXPENSE_CADENCE_LABELS[expense.cadence]}
                        {expense.due_day ? ` · pay day ${expense.due_day}` : ""}
                        {expense.debt_id ? " · linked to debt" : ""}
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <button onClick={() => setMode({ kind: "edit", expense })} className={ghostButtonClass}>
                          Edit
                        </button>
                        <ArchiveButton id={expense.id} name={expense.category} />
                      </div>
                    </li>
                  );
                })}
              </ul>

              <ExpensesRailCard rail={rail} />
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

const RAIL_ACCENTS = [
  "--color-accent-blue",
  "--color-accent-emerald",
  "--color-accent-amber",
  "--color-accent-purple",
  "--color-accent-pink",
  "--color-accent-red",
];

function ExpensesRailCard({ rail }: { rail: ExpensesRail }) {
  const total = rail.byGroup.reduce((s, g) => s + g.amount, 0);
  const items = rail.byGroup.map((g, i) => ({
    label: g.group,
    amount: g.amount,
    pct: total > 0 ? g.amount / total : 0,
    accentVar: RAIL_ACCENTS[i % RAIL_ACCENTS.length],
  }));

  return (
    <aside aria-label="Where your money goes" className="mt-6 space-y-4 lg:mt-0">
      <div className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5">
        <p className={labelClass}>// money going toward</p>
        <div className="mt-4">
          <BarList ariaLabel="Money going toward" items={items} />
        </div>
      </div>
      <div className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5">
        <p className={labelClass}>// subscriptions</p>
        <p className="mt-3 font-sans text-2xl font-medium tabular-nums text-[var(--color-text-primary)]">
          {formatUsd(rail.subscriptionTotal)}
          <span className="ml-2 font-mono text-[11px] text-[var(--color-text-muted)]">/mo</span>
        </p>
        <p className="mt-1 font-mono text-[11px] text-[var(--color-text-secondary)]">
          {rail.subscriptionCount} active subscription{rail.subscriptionCount === 1 ? "" : "s"}
        </p>
      </div>
    </aside>
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
