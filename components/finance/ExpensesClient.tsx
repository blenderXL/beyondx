"use client";

import { useActionState, useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { StatCard } from "@/components/layout/StatCard";
import { createExpense, updateExpense, archiveExpense, togglePaid, payAllExpenses } from "@/app/(app)/actions";
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
import { filterAndSortExpenses, EXPENSE_SORTS, type ExpenseSort } from "@/lib/finance/expensesView";
import { splitPayment } from "@/lib/finance/payment";
import { DebtTypeIcon } from "@/components/finance/DebtTypeIcon";
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

/** A recurring debt obligation auto-shown as a checkable bill row (not a stored expense). */
export interface DebtBill {
  id: string;
  name: string;
  type: DebtType;
  balance: number;
  apr: number;
  min_payment: number;
  escrow: number | null;
  pmi: number | null;
  dueDay: number | null;
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
  billingMonth,
  paidExpenseIds,
  debtBills,
  paidDebtIds,
}: {
  expenses: Expense[];
  debts: DebtOption[];
  rail: ExpensesRail;
  /** Monthly income — resolves a percent offering to its dollar value in the listed total. */
  income: number;
  /** First-of-month ISO date the check-offs are keyed to. */
  billingMonth: string;
  /** Expense ids already checked off (paid) this month. */
  paidExpenseIds: string[];
  /** Recurring debt obligations auto-shown as bill rows. */
  debtBills: DebtBill[];
  /** Debt ids already checked off (paid) this month. */
  paidDebtIds: string[];
}) {
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const toList = useCallback(() => setMode({ kind: "list" }), []);
  const total = expenses.reduce((sum, e) => sum + expenseDisplayAmount(e, income), 0);
  const paid = useMemo(() => new Set(paidExpenseIds), [paidExpenseIds]);
  const paidDebt = useMemo(() => new Set(paidDebtIds), [paidDebtIds]);
  const allPaid =
    expenses.length + debtBills.length > 0 &&
    expenses.every((e) => paid.has(e.id)) &&
    debtBills.every((b) => paidDebt.has(b.id));

  // List controls (client-side over the loaded expenses).
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<ExpenseGroup | "all">("all");
  const [sort, setSort] = useState<ExpenseSort>("amount_desc");
  const presentGroups = useMemo(
    () => EXPENSE_GROUPS.filter((g) => expenses.some((e) => e.expense_group === g)),
    [expenses],
  );
  const visible = useMemo(
    () => filterAndSortExpenses(expenses, { query, group, sort }),
    [expenses, query, group, sort],
  );

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className={labelClass}>// expenses</p>
          <h1 className="mt-2 font-sans text-3xl font-medium text-[var(--color-text-primary)]">
            Your expenses
          </h1>
        </div>
        {mode.kind === "list" ? (
          <div className="flex items-center gap-2">
            {expenses.length > 0 ? <PayAllButton billingMonth={billingMonth} allPaid={allPaid} /> : null}
            <button onClick={() => setMode({ kind: "create" })} className={primaryButtonClass}>
              New expense
            </button>
          </div>
        ) : null}
      </header>

      {mode.kind === "create" ? <ExpenseForm debts={debts} onDone={toList} onCancel={toList} /> : null}
      {mode.kind === "edit" ? (
        <ExpenseForm expense={mode.expense} debts={debts} onDone={toList} onCancel={toList} />
      ) : null}

      {mode.kind === "list" ? (
        expenses.length === 0 && debtBills.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-strong)] p-10 text-center">
            <p className="font-mono text-sm text-[var(--color-text-muted)]">
              // no expenses yet — add your bills to start planning
            </p>
          </div>
        ) : (
          <>
            {expenses.length > 0 ? (
              <>
                <ExpenseControls
                  query={query}
                  onQuery={setQuery}
                  group={group}
                  onGroup={setGroup}
                  presentGroups={presentGroups}
                  sort={sort}
                  onSort={setSort}
                />

                <div className="lg:grid lg:grid-cols-[1fr_17rem] lg:items-start lg:gap-6">
                  <div>
                    {visible.length === 0 ? (
                      <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-strong)] p-10 text-center">
                        <p className="font-mono text-sm text-[var(--color-text-muted)]">
                          // no expenses match your search or filter
                        </p>
                      </div>
                    ) : (
                      <ul aria-label="Expenses" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {visible.map((expense) => (
                          <ExpenseCard
                            key={expense.id}
                            expense={expense}
                            paid={paid.has(expense.id)}
                            billingMonth={billingMonth}
                            onEdit={() => setMode({ kind: "edit", expense })}
                          />
                        ))}
                      </ul>
                    )}
                  </div>

                  <ExpensesRailCard rail={rail} count={expenses.length} total={total} />
                </div>
              </>
            ) : null}

            {debtBills.length > 0 ? (
              <section className="mt-8">
                <p className={labelClass}>// debt payments this month</p>
                <p className="mt-1 font-mono text-[11px] text-[var(--color-text-muted)]">
                  Your debts, pre-filled with their minimum — edit what you&apos;ll pay, then check it off.
                  The balance drops by the principal portion.
                </p>
                <ul aria-label="Debt payments" className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {debtBills.map((b) => (
                    <DebtBillCard key={b.id} bill={b} paid={paidDebt.has(b.id)} billingMonth={billingMonth} />
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )
      ) : null}
    </div>
  );
}

/** One-line search + group filter + sort toolbar (mirrors the debts toolbar). */
function ExpenseControls({
  query,
  onQuery,
  group,
  onGroup,
  presentGroups,
  sort,
  onSort,
}: {
  query: string;
  onQuery: (v: string) => void;
  group: ExpenseGroup | "all";
  onGroup: (v: ExpenseGroup | "all") => void;
  presentGroups: readonly ExpenseGroup[];
  sort: ExpenseSort;
  onSort: (v: ExpenseSort) => void;
}) {
  // `inputClass` carries `w-full`; force auto width on the selects so they sit compactly.
  const selectClass = `${inputClass} mt-0 h-10 !w-auto max-w-[12rem]`;
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-text-muted)]"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          aria-label="Search expenses"
          placeholder="Search by name or payee…"
          className={`${inputClass} mt-0 h-10 pl-9`}
        />
      </div>
      <div className="flex items-center gap-3">
        <select
          value={group}
          onChange={(e) => onGroup(e.target.value as ExpenseGroup | "all")}
          aria-label="Filter by group"
          className={selectClass}
        >
          <option value="all">All groups</option>
          {presentGroups.map((g) => (
            <option key={g} value={g}>
              {EXPENSE_GROUP_LABELS[g]}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => onSort(e.target.value as ExpenseSort)}
          aria-label="Sort expenses"
          className={selectClass}
        >
          {EXPENSE_SORTS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

const inlineFieldClass =
  "mt-1 block h-9 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] px-2 font-mono text-sm text-[var(--color-text-primary)] tabular-nums outline-none focus:border-[var(--color-text-primary)]";
const inlineLabelClass = "font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]";

/**
 * Per-card "paid this month" checkbox. Submits togglePaid; the server records the payment and,
 * for a debt-linked expense, draws the balance down by the principal portion of what you pay.
 */
function CheckOff({
  expenseId,
  name,
  paid,
  billingMonth,
}: {
  expenseId: string;
  name: string;
  paid: boolean;
  billingMonth: string;
}) {
  const [, formAction] = useActionState(togglePaid, INITIAL_FINANCE_STATE);
  return (
    <form action={formAction} className="shrink-0 pt-0.5">
      <input type="hidden" name="kind" value="expense" />
      <input type="hidden" name="item_id" value={expenseId} />
      <input type="hidden" name="billing_month" value={billingMonth} />
      <input
        type="checkbox"
        name="checked"
        aria-label={`Mark ${name} paid`}
        defaultChecked={paid}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="size-4 cursor-pointer accent-[var(--color-accent-emerald)]"
      />
    </form>
  );
}

/** "Pay all this month" — checks off every still-unpaid expense in one go. */
function PayAllButton({ billingMonth, allPaid }: { billingMonth: string; allPaid: boolean }) {
  const [state, formAction, pending] = useActionState(payAllExpenses, INITIAL_FINANCE_STATE);
  return (
    <form action={formAction}>
      <input type="hidden" name="billing_month" value={billingMonth} />
      <button
        type="submit"
        disabled={pending || allPaid}
        className={ghostButtonClass}
        aria-label="Pay all this month"
      >
        {pending ? "Paying…" : allPaid ? "All paid" : "Pay all"}
      </button>
      {state.error ? <span role="alert" className={`ml-2 ${errorClass}`}>{state.error}</span> : null}
    </form>
  );
}

/**
 * Expense card with inline quick-edit of amount + pay day (no full-form round trip). The
 * unchanged fields ride along as hidden inputs so the server validator gets a complete
 * expense; a percent offering keeps its % display and only its pay day is editable.
 */
function ExpenseCard({
  expense,
  paid,
  billingMonth,
  onEdit,
}: {
  expense: Expense;
  paid: boolean;
  billingMonth: string;
  onEdit: () => void;
}) {
  const isPercentOffering = expense.expense_group === "offering" && expense.pct_of_income != null;
  const [state, formAction, pending] = useActionState(updateExpense, INITIAL_FINANCE_STATE);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (state.ok) setDirty(false);
  }, [state.ok]);

  return (
    <li className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <CheckOff expenseId={expense.id} name={expense.category} paid={paid} billingMonth={billingMonth} />
          <div className="min-w-0">
            <p
              className={`font-sans text-sm font-medium break-words ${
                paid ? "text-[var(--color-text-muted)] line-through" : "text-[var(--color-text-primary)]"
              }`}
            >
              {expense.category}
            </p>
            <p className="mt-0.5 font-mono text-[10px] tracking-[0.16em] break-words text-[var(--color-text-muted)] uppercase">
              {expense.expense_group ? EXPENSE_GROUP_LABELS[expense.expense_group] : "Ungrouped"}
              {expense.payee ? ` · ${expense.payee}` : ""}
              {expense.debt_id ? " · linked" : ""}
            </p>
          </div>
        </div>
        {isPercentOffering ? (
          <p className="shrink-0 font-sans text-lg font-medium text-[var(--color-text-primary)] tabular-nums">
            {expense.pct_of_income}% of income
          </p>
        ) : null}
      </div>

      <form action={formAction} className="mt-3 flex items-end gap-2">
        <input type="hidden" name="id" value={expense.id} />
        <input type="hidden" name="category" value={expense.category} />
        <input type="hidden" name="expense_group" value={expense.expense_group ?? ""} />
        <input type="hidden" name="payee" value={expense.payee ?? ""} />
        <input type="hidden" name="cadence" value={expense.cadence} />
        <input type="hidden" name="debt_id" value={expense.debt_id ?? ""} />
        {isPercentOffering ? (
          <>
            <input type="hidden" name="pct_of_income" value={String(expense.pct_of_income)} />
            <input type="hidden" name="amount" value="0" />
          </>
        ) : (
          <label className="flex-1">
            <span className={inlineLabelClass}>Amount $</span>
            <input
              name="amount"
              inputMode="decimal"
              defaultValue={String(expense.amount)}
              aria-label={`Amount for ${expense.category}`}
              onChange={() => setDirty(true)}
              className={inlineFieldClass}
            />
          </label>
        )}
        <label className="w-20">
          <span className={inlineLabelClass}>Pay day</span>
          <input
            name="due_day"
            type="number"
            min={1}
            max={31}
            step={1}
            defaultValue={expense.due_day ?? ""}
            aria-label={`Pay day for ${expense.category}`}
            onChange={() => setDirty(true)}
            className={inlineFieldClass}
          />
        </label>
        <button
          type="submit"
          disabled={!dirty || pending}
          className="flex h-9 shrink-0 items-center rounded-md bg-[var(--color-text-primary)] px-3 font-mono text-[10px] tracking-[0.18em] text-[var(--color-canvas)] uppercase transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {pending ? "…" : "Save"}
        </button>
      </form>

      <p className="mt-2 font-mono text-[11px] text-[var(--color-text-secondary)]">
        {EXPENSE_CADENCE_LABELS[expense.cadence]}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={onEdit} className={ghostButtonClass}>
          Edit
        </button>
        <ArchiveButton id={expense.id} name={expense.category} />
      </div>

      {state.error ? (
        <p role="alert" className={`mt-2 ${errorClass}`}>
          // {state.error}
        </p>
      ) : null}
    </li>
  );
}

/**
 * A recurring debt obligation as a checkable bill. The payment defaults to the minimum and is
 * editable for the month; checking off records the payment and draws the balance down by the
 * principal portion (shown live as you edit the amount).
 */
function DebtBillCard({ bill, paid, billingMonth }: { bill: DebtBill; paid: boolean; billingMonth: string }) {
  const [amount, setAmount] = useState(String(bill.min_payment));
  const [, formAction] = useActionState(togglePaid, INITIAL_FINANCE_STATE);
  const n = Number(amount);
  const split = splitPayment({
    balance: bill.balance,
    apr: bill.apr,
    total: Number.isFinite(n) ? n : 0,
    escrow: bill.escrow ?? 0,
    pmi: bill.pmi ?? 0,
  });
  const extras = split.escrow + split.pmi;

  return (
    <li className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-4">
      <form action={formAction}>
        <input type="hidden" name="kind" value="debt" />
        <input type="hidden" name="item_id" value={bill.id} />
        <input type="hidden" name="billing_month" value={billingMonth} />

        <div className="flex min-w-0 items-start gap-3">
          <input
            type="checkbox"
            name="checked"
            aria-label={`Mark ${bill.name} paid`}
            defaultChecked={paid}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[var(--color-accent-emerald)]"
          />
          <div className="min-w-0">
            <p
              className={`font-sans text-sm font-medium break-words ${
                paid ? "text-[var(--color-text-muted)] line-through" : "text-[var(--color-text-primary)]"
              }`}
            >
              {bill.name}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] tracking-[0.16em] text-[var(--color-text-muted)] uppercase">
              <DebtTypeIcon type={bill.type} className="size-3" />
              Debt{bill.dueDay ? ` · due day ${bill.dueDay}` : ""}
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-end gap-3">
          <label className="flex-1">
            <span className={inlineLabelClass}>Pay $</span>
            <input
              name="amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-label={`Payment for ${bill.name}`}
              className={inlineFieldClass}
            />
          </label>
          <p className="pb-1.5 text-right font-mono text-[11px] tabular-nums text-[var(--color-text-secondary)]">
            ≈ {formatUsd(split.principal)} principal
            <span className="block text-[10px] text-[var(--color-text-muted)]">
              {formatUsd(split.interest)} interest{extras > 0 ? ` · ${formatUsd(extras)} esc/PMI` : ""}
            </span>
          </p>
        </div>
      </form>
    </li>
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

function ExpensesRailCard({ rail, count, total }: { rail: ExpensesRail; count: number; total: number }) {
  const barTotal = rail.byGroup.reduce((s, g) => s + g.amount, 0);
  const items = rail.byGroup.map((g, i) => ({
    label: g.group,
    amount: g.amount,
    pct: barTotal > 0 ? g.amount / barTotal : 0,
    accentVar: RAIL_ACCENTS[i % RAIL_ACCENTS.length],
  }));

  return (
    <aside aria-label="Where your money goes" className="mt-6 space-y-4 lg:mt-0">
      <StatCard label="Expenses tracked" value={String(count)} accentVar="--color-accent-blue" />
      <StatCard label="Listed total" value={formatUsd(total)} hint="incl. offerings" accentVar="--color-accent-amber" />
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
