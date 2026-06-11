"use client";

import { useActionState, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  LayoutGrid,
  Layers,
  List,
  ChevronDown,
  Calendar,
  CreditCard,
  Undo2,
  Home,
  Zap,
  Car,
  ShieldCheck,
  Utensils,
  HeartPulse,
  Repeat,
  Landmark,
  HandCoins,
  User,
  Wallet,
  Plus,
  Briefcase,
  type LucideIcon,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import {
  createExpense,
  updateExpense,
  archiveExpense,
  togglePaid,
  toggleSavingsPaid,
  payAllExpenses,
  revertAllExpenses,
  archiveIncome,
} from "@/app/(app)/actions";
import { INITIAL_FINANCE_STATE } from "@/lib/finance/actionState";
import {
  EXPENSE_CADENCES,
  EXPENSE_CADENCE_LABELS,
  EXPENSE_GROUPS,
  EXPENSE_GROUP_LABELS,
  INCOME_CADENCE_LABELS,
  type Expense,
  type ExpenseGroup,
  type DebtType,
  type Income,
} from "@/lib/finance/types";
import { filterAndSortExpenses, partitionPaidLast, EXPENSE_SORTS, type ExpenseSort } from "@/lib/finance/expensesView";
import { splitPayment } from "@/lib/finance/payment";
import type { MonthlyPlan } from "@/lib/finance/planner";
import { DebtTypeIcon } from "@/components/finance/DebtTypeIcon";
import { MonthSwitcher } from "@/components/finance/MonthSwitcher";
import { type MonthOption } from "@/lib/finance/history";
import { IncomeForm } from "@/components/finance/IncomeClient";
import { formatUsd, expenseDisplayAmount } from "@/lib/finance/derive";
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

/** Minimal savings shape for the form's "Pay toward savings" picker. */
export interface SavingsOption {
  id: string;
  name: string;
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

/** A recurring savings contribution auto-shown as a checkable bill row. */
export interface SavingsBill {
  id: string;
  name: string;
  monthly_contribution: number;
}

/** Server-computed summary for the right rail. */
export interface ExpensesRail {
  byGroup: { group: string; amount: number }[];
  subscriptionCount: number;
  subscriptionTotal: number;
  /** Planned monthly savings = sum of each goal's monthly_contribution. */
  savingsMonthly: number;
}

/** Per-source monthly income (override-resolved) — the offering card breaks its % down over these. */
export interface IncomeBreakdownItem {
  source: string;
  monthly: number;
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
  savingsGoals,
  onDone,
  onCancel,
}: {
  expense?: Expense;
  debts: DebtOption[];
  savingsGoals: SavingsOption[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const editing = Boolean(expense);
  const hasDebts = debts.length > 0;
  const hasSavings = savingsGoals.length > 0;
  const [state, formAction, pending] = useActionState(
    editing ? updateExpense : createExpense,
    INITIAL_FINANCE_STATE,
  );
  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  // First decision: pay toward a debt, toward savings, or a plain expense. Controlled fields
  // let a debt/savings pick prefill the name (all still editable).
  const [kind, setKind] = useState<"debt" | "savings" | "other">(
    expense?.debt_id ? "debt" : expense?.savings_goal_id ? "savings" : "other",
  );
  const [debtId, setDebtId] = useState(expense?.debt_id ?? "");
  const [savingsId, setSavingsId] = useState(expense?.savings_goal_id ?? "");
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
  function pickSavings(id: string) {
    setSavingsId(id);
    const g = savingsGoals.find((x) => x.id === id);
    if (g && !category) setCategory(g.name);
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
            { v: "debt" as const, label: "Pay toward a debt", disabled: !hasDebts },
            { v: "savings" as const, label: "Pay toward savings", disabled: !hasSavings },
            { v: "other" as const, label: "Other expense", disabled: false },
          ]
        ).map(({ v, label, disabled }) => (
          <button
            key={v}
            type="button"
            onClick={() => setKind(v)}
            aria-pressed={kind === v}
            disabled={disabled}
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

      {/* Carried hidden so the server gets the link(s) + (for offerings) the percent. */}
      <input type="hidden" name="debt_id" value={kind === "debt" ? debtId : ""} />
      <input type="hidden" name="savings_goal_id" value={kind === "savings" ? savingsId : ""} />

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

        {kind === "savings" ? (
          <label className="block sm:col-span-2">
            <span className={labelClass}>Which savings goal?</span>
            <select
              aria-label="Which savings goal"
              value={savingsId}
              onChange={(e) => pickSavings(e.target.value)}
              className={inputClass}
            >
              <option value="">— Choose a savings goal —</option>
              {savingsGoals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <span className="mt-1 block font-mono text-[10px] text-[var(--color-text-muted)]">
              Paying this expense adds the amount to that pot&apos;s balance.
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

type Mode = { kind: "list" } | { kind: "create" } | { kind: "edit"; id: string };

/** Card grid vs. grouped-by-category (the "group by" view, mirroring the debts page). */
type ExpenseView = "card" | "category" | "list";
const VIEW_KEY = "nzx.expenses.view";

export function ExpensesClient({
  expenses,
  debts,
  rail,
  income,
  billingMonth,
  paidExpenseIds,
  debtBills,
  paidDebtIds,
  savingsBills,
  paidSavingsIds,
  plan,
  incomes,
  incomeBreakdown,
  savingsOptions,
  months,
  currentMonth,
}: {
  expenses: Expense[];
  debts: DebtOption[];
  /** Savings goals for the form's "Pay toward savings" picker. */
  savingsOptions: SavingsOption[];
  rail: ExpensesRail;
  /** This month's computed budget — income/offerings/expenses/minimums/leftover + by-cycle. */
  plan: MonthlyPlan;
  /** All income sources, for the embedded income manager (add/edit/remove). */
  incomes: Income[];
  /** Per-source monthly income (after overrides) — powers the offering card's breakdown. */
  incomeBreakdown: IncomeBreakdownItem[];
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
  /** Recurring savings contributions auto-shown as bill rows. */
  savingsBills: SavingsBill[];
  /** Savings ids already contributed this month. */
  paidSavingsIds: string[];
  /** Month-switcher options (current + prior 11). */
  months: MonthOption[];
  /** The current billing month (the live, editable view). */
  currentMonth: string;
}) {
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const toList = useCallback(() => setMode({ kind: "list" }), []);

  // The dashboard's quick-add FAB links here with ?new=1 — open the create modal once, then
  // strip the param so a refresh doesn't reopen it.
  const router = useRouter();
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setMode({ kind: "create" });
      router.replace("/app/expenses");
    }
  }, [searchParams, router]);
  const paid = useMemo(() => new Set(paidExpenseIds), [paidExpenseIds]);
  const paidDebt = useMemo(() => new Set(paidDebtIds), [paidDebtIds]);
  const paidSavings = useMemo(() => new Set(paidSavingsIds), [paidSavingsIds]);
  const allPaid =
    expenses.length + debtBills.length + savingsBills.length > 0 &&
    expenses.every((e) => paid.has(e.id)) &&
    debtBills.every((b) => paidDebt.has(b.id)) &&
    savingsBills.every((b) => paidSavings.has(b.id));

  // List controls (client-side over the loaded expenses).
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<ExpenseGroup | "all">("all");
  const [sort, setSort] = useState<ExpenseSort>("amount_desc");
  const [view, setView] = useState<ExpenseView>("card");

  // Persist the view across reloads (hydrated post-mount to avoid an SSR mismatch).
  const [viewHydrated, setViewHydrated] = useState(false);
  useEffect(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      if (v === "card" || v === "category" || v === "list") setView(v);
    } catch {
      /* storage unavailable — use the default */
    }
    setViewHydrated(true);
  }, []);
  useEffect(() => {
    if (!viewHydrated) return;
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      /* ignore */
    }
  }, [viewHydrated, view]);

  const presentGroups = useMemo(
    () => EXPENSE_GROUPS.filter((g) => expenses.some((e) => e.expense_group === g)),
    [expenses],
  );
  const visible = useMemo(
    () => filterAndSortExpenses(expenses, { query, group, sort }),
    [expenses, query, group, sort],
  );
  const grouped = useMemo(() => groupByExpenseGroup(visible, income), [visible, income]);
  // Settled bills sink to the bottom of every view (sort holds within unpaid/paid partitions).
  const orderedVisible = useMemo(() => partitionPaidLast(visible, paid), [visible, paid]);
  const groupedOrdered = useMemo(
    () => grouped.map((g) => ({ ...g, expenses: partitionPaidLast(g.expenses, paid) })),
    [grouped, paid],
  );
  // Resolve the edit target from the live list so archiving it closes the modal.
  const editExpense = mode.kind === "edit" ? (expenses.find((e) => e.id === mode.id) ?? null) : null;
  // THIS-MONTH budget math (user's formula): budget left = income − expenses − giving − savings
  // (no debt minimums). Savings = the planned monthly contributions to the user's savings goals.
  const budgetLeft =
    Math.round((plan.income - plan.expenses - plan.offerings - rail.savingsMonthly) * 100) / 100;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={labelClass}>// expenses</p>
          <h1 className="mt-2 font-sans text-3xl font-medium text-[var(--color-text-primary)]">
            Your expenses
          </h1>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <MonthSwitcher months={months} selected={currentMonth} currentMonth={currentMonth} />
          {expenses.length > 0 ? <PayAllButton billingMonth={billingMonth} allPaid={allPaid} /> : null}
          <button onClick={() => setMode({ kind: "create" })} className={primaryButtonClass}>
            New expense
          </button>
        </div>
      </header>

      <Modal
        open={mode.kind === "create" || editExpense != null}
        onClose={toList}
        label={mode.kind === "edit" ? "Edit expense" : "New expense"}
      >
        {mode.kind === "create" ? (
          <ExpenseForm debts={debts} savingsGoals={savingsOptions} onDone={toList} onCancel={toList} />
        ) : null}
        {editExpense ? (
          <>
            <ExpenseForm
              expense={editExpense}
              debts={debts}
              savingsGoals={savingsOptions}
              onDone={toList}
              onCancel={toList}
            />
            {/* Archive lives in the editor now (no buttons on the card). Sibling form — not nested. */}
            <div className="mt-4 flex justify-end">
              <ArchiveButton id={editExpense.id} name={editExpense.category} />
            </div>
          </>
        ) : null}
      </Modal>

      <div className="lg:grid lg:grid-cols-[1fr_20rem] lg:items-start lg:gap-6">
        {/* Left: the bills */}
        <div>
          {expenses.length === 0 && debtBills.length === 0 && savingsBills.length === 0 ? (
            <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-strong)] p-10 text-center">
              <p className="font-mono text-sm text-[var(--color-text-muted)]">
                // no bills yet — add an expense or set a debt/savings minimum to start planning
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
                    view={view}
                    onView={setView}
                  />
                  {visible.length === 0 ? (
                    <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-strong)] p-10 text-center">
                      <p className="font-mono text-sm text-[var(--color-text-muted)]">
                        // no expenses match your search or filter
                      </p>
                    </div>
                  ) : view === "category" ? (
                    <div className="space-y-8">
                      {groupedOrdered.map((g) => (
                        <section key={g.group} aria-label={g.label}>
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <p className={labelClass}>// {g.label.toLowerCase()}</p>
                            <p className="font-mono text-[11px] tabular-nums text-[var(--color-text-muted)]">
                              {g.expenses.length} · {formatUsd(g.total)}
                            </p>
                          </div>
                          <ul aria-label={g.label} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            {g.expenses.map((expense) => (
                              <ExpenseCard
                                key={expense.id}
                                expense={expense}
                                paid={paid.has(expense.id)}
                                billingMonth={billingMonth}
                                incomeBreakdown={incomeBreakdown}
                                onEdit={() => setMode({ kind: "edit", id: expense.id })}
                              />
                            ))}
                          </ul>
                        </section>
                      ))}
                    </div>
                  ) : view === "list" ? (
                    <ul
                      aria-label="Expenses"
                      className="divide-y divide-[var(--color-border-subtle)] overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)]"
                    >
                      {orderedVisible.map((expense) => (
                        <ExpenseRow
                          key={expense.id}
                          expense={expense}
                          paid={paid.has(expense.id)}
                          billingMonth={billingMonth}
                          income={income}
                          onEdit={() => setMode({ kind: "edit", id: expense.id })}
                        />
                      ))}
                    </ul>
                  ) : (
                    <ul aria-label="Expenses" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {orderedVisible.map((expense) => (
                        <ExpenseCard
                          key={expense.id}
                          expense={expense}
                          paid={paid.has(expense.id)}
                          billingMonth={billingMonth}
                          incomeBreakdown={incomeBreakdown}
                          onEdit={() => setMode({ kind: "edit", id: expense.id })}
                        />
                      ))}
                    </ul>
                  )}
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

              {savingsBills.length > 0 ? (
                <section className="mt-8">
                  <p className={labelClass}>// savings this month</p>
                  <p className="mt-1 font-mono text-[11px] text-[var(--color-text-muted)]">
                    Recurring contributions — check one off to add it to the pot.
                  </p>
                  <ul aria-label="Savings contributions" className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {savingsBills.map((b) => (
                      <SavingsBillCard key={b.id} bill={b} paid={paidSavings.has(b.id)} billingMonth={billingMonth} />
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          )}
        </div>

        {/* Right: the stitch sidebar — budget, breakdown, income, subscriptions */}
        <ExpensesRail plan={plan} budgetLeft={budgetLeft} incomes={incomes} rail={rail} />
      </div>
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
  view,
  onView,
}: {
  query: string;
  onQuery: (v: string) => void;
  group: ExpenseGroup | "all";
  onGroup: (v: ExpenseGroup | "all") => void;
  presentGroups: readonly ExpenseGroup[];
  sort: ExpenseSort;
  onSort: (v: ExpenseSort) => void;
  view: ExpenseView;
  onView: (v: ExpenseView) => void;
}) {
  // One sharp control height shared by every toolbar element so they align (stitch reference).
  const ctrl =
    "h-9 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] font-mono text-[12px] text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-text-primary)]";
  return (
    <div className="mb-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* View toggle — far left, like the stitch CARD / GROUP pill. */}
      <div className="flex h-9 shrink-0 items-center gap-1 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] p-1">
        {(
          [
            { v: "card" as const, Icon: LayoutGrid, label: "Card", aria: "Card view" },
            { v: "list" as const, Icon: List, label: "List", aria: "List view" },
            { v: "category" as const, Icon: Layers, label: "Group", aria: "Group by category" },
          ]
        ).map(({ v, Icon, label, aria }) => (
          <button
            key={v}
            type="button"
            onClick={() => onView(v)}
            aria-label={aria}
            aria-pressed={view === v}
            className={`flex items-center gap-2 rounded px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors ${
              view === v
                ? "bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            <Icon className="size-3.5" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {/* Search + filters — grouped on the right. */}
      <div className="flex flex-1 items-center gap-3 sm:flex-none">
        <div className="relative flex-1 sm:w-64 sm:flex-none">
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
            className={`${ctrl} w-full pl-9 pr-3 placeholder:text-[var(--color-text-muted)]`}
          />
        </div>
        <div className="relative shrink-0">
          <select
            value={group}
            onChange={(e) => onGroup(e.target.value as ExpenseGroup | "all")}
            aria-label="Filter by group"
            className={`${ctrl} appearance-none pl-3 pr-8`}
          >
            <option value="all">All groups</option>
            {presentGroups.map((g) => (
              <option key={g} value={g}>
                {EXPENSE_GROUP_LABELS[g]}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--color-text-muted)]" aria-hidden />
        </div>
        <div className="relative shrink-0">
          <select
            value={sort}
            onChange={(e) => onSort(e.target.value as ExpenseSort)}
            aria-label="Sort expenses"
            className={`${ctrl} appearance-none pl-3 pr-8`}
          >
            {EXPENSE_SORTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--color-text-muted)]" aria-hidden />
        </div>
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
/** The expense card's single button: pay this month, or revert if already paid. togglePaid
 * toggles both ways — `checked` present ⇒ pay; absent ⇒ revert. */
function PayToggle({
  expenseId,
  name,
  paid,
  billingMonth,
  compact = false,
}: {
  expenseId: string;
  name: string;
  paid: boolean;
  billingMonth: string;
  /** Auto-width pill for the list row (vs. the full-width card button). */
  compact?: boolean;
}) {
  const [, formAction, pending] = useActionState(togglePaid, INITIAL_FINANCE_STATE);
  const size = compact ? "px-3 py-1.5" : "w-full py-2";
  return (
    <form action={formAction}>
      <input type="hidden" name="kind" value="expense" />
      <input type="hidden" name="item_id" value={expenseId} />
      <input type="hidden" name="billing_month" value={billingMonth} />
      {!paid ? <input type="hidden" name="checked" value="on" /> : null}
      <button
        type="submit"
        disabled={pending}
        aria-label={paid ? `Revert ${name}` : `Pay ${name}`}
        className={
          paid
            ? `flex ${size} items-center justify-center gap-2 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)] disabled:opacity-40`
            : `flex ${size} items-center justify-center gap-2 rounded-md border border-[color-mix(in_oklab,var(--color-accent-red),transparent_70%)] bg-[var(--color-elevated)] font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-accent-red)] transition-colors hover:bg-[color-mix(in_oklab,var(--color-accent-red),transparent_88%)] disabled:opacity-40`
        }
      >
        {pending ? (
          "…"
        ) : paid ? (
          <>
            <Undo2 className="size-3.5" aria-hidden /> Revert
          </>
        ) : (
          <>
            <CreditCard className="size-3.5" aria-hidden /> Pay now
          </>
        )}
      </button>
    </form>
  );
}

/** "Pay all this month" ⇄ "Revert" — pays every planned item, or undoes the month's payments. */
function PayAllButton({ billingMonth, allPaid }: { billingMonth: string; allPaid: boolean }) {
  const [state, formAction, pending] = useActionState(
    allPaid ? revertAllExpenses : payAllExpenses,
    INITIAL_FINANCE_STATE,
  );
  return (
    <form action={formAction}>
      <input type="hidden" name="billing_month" value={billingMonth} />
      <button
        type="submit"
        disabled={pending}
        className={ghostButtonClass}
        aria-label={allPaid ? "Revert this month's payments" : "Pay all this month"}
      >
        {pending ? "Working…" : allPaid ? "Revert" : "Pay all"}
      </button>
      {state.error ? <span role="alert" className={`ml-2 ${errorClass}`}>{state.error}</span> : null}
    </form>
  );
}

/** Day-of-month with an ordinal suffix: 1 → "1st", 22 → "22nd". */
function ordinal(day: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = day % 100;
  return `${day}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/** Left accent-stripe color per expense group (mirrors the design's semantic cues). */
const GROUP_ACCENT: Record<ExpenseGroup, string> = {
  utility: "--color-accent-amber",
  insurance: "--color-accent-blue",
  housing: "--color-accent-red",
  credit_card: "--color-accent-purple",
  transportation: "--color-accent-blue",
  food: "--color-accent-emerald",
  healthcare: "--color-accent-pink",
  subscription: "--color-accent-pink",
  loan: "--color-accent-purple",
  offering: "--color-accent-purple",
  personal: "--color-accent-emerald",
  other: "--color-accent-blue",
};
function groupAccent(g: ExpenseGroup | null): string {
  return g ? GROUP_ACCENT[g] : "--color-border-strong";
}

/** A representative icon per expense group (stitch card affordance). */
const GROUP_ICON: Record<ExpenseGroup, LucideIcon> = {
  utility: Zap,
  insurance: ShieldCheck,
  housing: Home,
  credit_card: CreditCard,
  transportation: Car,
  food: Utensils,
  healthcare: HeartPulse,
  subscription: Repeat,
  loan: Landmark,
  offering: HandCoins,
  personal: User,
  other: Wallet,
};
function groupIcon(g: ExpenseGroup | null): LucideIcon {
  return g ? GROUP_ICON[g] : Wallet;
}

/** "$2,450.00" → "2,450.00" so the card can render a muted "$" prefix separately. */
function amountDigits(n: number): string {
  return formatUsd(n).replace(/^\$/, "");
}

/** Group the (already filtered/sorted) expenses by category, with per-group totals. */
function groupByExpenseGroup(
  expenses: Expense[],
  income: number,
): { group: ExpenseGroup | "ungrouped"; label: string; expenses: Expense[]; total: number }[] {
  const order: (ExpenseGroup | "ungrouped")[] = [...EXPENSE_GROUPS, "ungrouped"];
  return order
    .map((g) => {
      const items = expenses.filter((e) => (e.expense_group ?? "ungrouped") === g);
      return {
        group: g,
        label: g === "ungrouped" ? "Ungrouped" : EXPENSE_GROUP_LABELS[g],
        expenses: items,
        total: items.reduce((s, e) => s + expenseDisplayAmount(e, income), 0),
      };
    })
    .filter((x) => x.expenses.length > 0);
}

/**
 * Expense card. Click the dollar amount to quick-edit it in place (the unchanged fields ride
 * along as hidden inputs so the server validator gets a complete expense). Click anywhere else
 * on the card to open the full editor modal. A percent offering shows its % (edit it in the
 * modal). The checkbox, inline editor, and footer buttons stop propagation so they don't open
 * the modal.
 */
function ExpenseCard({
  expense,
  paid,
  billingMonth,
  incomeBreakdown,
  onEdit,
}: {
  expense: Expense;
  paid: boolean;
  billingMonth: string;
  incomeBreakdown: IncomeBreakdownItem[];
  onEdit: () => void;
}) {
  const isPercentOffering = expense.expense_group === "offering" && expense.pct_of_income != null;
  const [state, formAction, pending] = useActionState(updateExpense, INITIAL_FINANCE_STATE);
  const [editingAmount, setEditingAmount] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  useEffect(() => {
    if (state.ok) setEditingAmount(false);
  }, [state.ok]);

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  // A percent offering breaks its % down across each income source; the total is the sum.
  const pct = expense.pct_of_income ?? 0;
  const offeringLines = isPercentOffering
    ? incomeBreakdown.map((b) => ({ source: b.source, amount: Math.round(b.monthly * pct) / 100 }))
    : [];
  const offeringTotal = offeringLines.reduce((s, l) => s + l.amount, 0);
  const accent = paid ? "--color-accent-emerald" : groupAccent(expense.expense_group);
  const Icon = groupIcon(expense.expense_group);

  return (
    <li>
      <div
        onClick={onEdit}
        className={`group relative cursor-pointer overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5 pl-6 transition-colors hover:border-[var(--color-border-strong)] ${
          paid ? "opacity-80" : ""
        }`}
      >
        <span aria-hidden className="absolute left-0 top-0 h-full w-1" style={{ background: `var(${accent})` }} />

        {/* Header: group icon + name, with a PAID chip when settled. */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden
              className="flex size-8 shrink-0 items-center justify-center rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-elevated)]"
              style={{ color: `var(${accent})` }}
            >
              <Icon className="size-[18px]" />
            </span>
            <span
              className={`min-w-0 truncate font-mono text-[12px] font-medium tracking-[0.02em] ${
                paid
                  ? "text-[var(--color-text-muted)] line-through decoration-[var(--color-border-strong)]"
                  : "text-[var(--color-text-primary)]"
              }`}
            >
              {expense.category}
            </span>
          </div>
          {paid ? (
            <span className="shrink-0 rounded bg-[color-mix(in_oklab,var(--color-accent-emerald),transparent_85%)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--color-accent-emerald)]">
              Paid
            </span>
          ) : null}
        </div>

        {/* Amount: muted "$" + big figure. Click to quick-edit (offering shows its % breakdown). */}
        {!editingAmount ? (
          <div className="mt-3">
            {isPercentOffering ? (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    stop(e);
                    setShowBreakdown((v) => !v);
                  }}
                  aria-label={`Show offering breakdown for ${expense.category}`}
                  aria-expanded={showBreakdown}
                  className="flex items-baseline gap-1 font-sans tabular-nums text-[var(--color-text-primary)] transition-colors hover:text-[var(--color-accent-emerald)]"
                >
                  <span className="text-sm text-[var(--color-text-muted)]">$</span>
                  <span className="text-2xl font-medium">{amountDigits(offeringTotal)}</span>
                  <ChevronDown
                    className={`size-4 self-center transition-transform ${showBreakdown ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </button>
                <p className="mt-0.5 font-mono text-[10px] text-[var(--color-text-muted)]">{pct}% of income</p>
              </>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  stop(e);
                  setEditingAmount(true);
                }}
                aria-label={`Edit amount for ${expense.category}`}
                className="flex items-baseline gap-1 font-sans tabular-nums transition-colors hover:text-[var(--color-accent-emerald)]"
              >
                <span className="text-sm text-[var(--color-text-muted)]">$</span>
                <span
                  className={`text-2xl font-medium ${
                    paid ? "text-[var(--color-text-muted)] line-through" : "text-[var(--color-text-primary)]"
                  }`}
                >
                  {amountDigits(Number(expense.amount))}
                </span>
              </button>
            )}
          </div>
        ) : null}

        {isPercentOffering && showBreakdown ? (
          <div
            onClick={stop}
            className="mt-3 space-y-1 rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-elevated)] p-3"
          >
            {offeringLines.length === 0 ? (
              <p className="font-mono text-[11px] text-[var(--color-text-muted)]">// add income to see the breakdown</p>
            ) : (
              <>
                {offeringLines.map((l) => (
                  <div key={l.source} className="flex items-center justify-between gap-3 font-mono text-[11px]">
                    <span className="truncate text-[var(--color-text-secondary)]">
                      {pct}% × {l.source}
                    </span>
                    <span className="shrink-0 tabular-nums text-[var(--color-text-primary)]">{formatUsd(l.amount)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border-subtle)] pt-1 font-mono text-[11px]">
                  <span className="text-[var(--color-text-muted)]">Total</span>
                  <span className="tabular-nums text-[var(--color-text-primary)]">{formatUsd(offeringTotal)}</span>
                </div>
              </>
            )}
          </div>
        ) : null}

        {editingAmount && !isPercentOffering ? (
          <form action={formAction} onClick={stop} className="mt-3 flex items-end gap-2">
            <input type="hidden" name="id" value={expense.id} />
            <input type="hidden" name="category" value={expense.category} />
            <input type="hidden" name="expense_group" value={expense.expense_group ?? ""} />
            <input type="hidden" name="payee" value={expense.payee ?? ""} />
            <input type="hidden" name="cadence" value={expense.cadence} />
            <input type="hidden" name="debt_id" value={expense.debt_id ?? ""} />
            <input type="hidden" name="due_day" value={expense.due_day ?? ""} />
            <label className="flex-1">
              <span className={inlineLabelClass}>Amount $</span>
              <input
                name="amount"
                inputMode="decimal"
                autoFocus
                defaultValue={String(expense.amount)}
                aria-label={`Amount for ${expense.category}`}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setEditingAmount(false);
                }}
                className={inlineFieldClass}
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="flex h-9 shrink-0 items-center rounded-md bg-[var(--color-text-primary)] px-3 font-mono text-[10px] tracking-[0.18em] text-[var(--color-canvas)] uppercase transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {pending ? "…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditingAmount(false)}
              className="flex h-9 shrink-0 items-center rounded-md border border-[var(--color-border-strong)] px-3 font-mono text-[10px] tracking-[0.18em] text-[var(--color-text-muted)] uppercase transition-colors hover:text-[var(--color-text-primary)]"
            >
              Cancel
            </button>
          </form>
        ) : null}

        <p className="mt-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
          <Calendar className="size-3 shrink-0" aria-hidden />
          {EXPENSE_CADENCE_LABELS[expense.cadence]}
          {expense.due_day ? ` · ${paid ? "paid" : "pay day"} ${ordinal(expense.due_day)}` : ""}
          {expense.debt_id || expense.savings_goal_id ? " · linked" : ""}
        </p>

        {/* The card's only button — pay this month, or revert. Edit/archive are a card-body click. */}
        <span onClick={stop} className="mt-4 block">
          <PayToggle expenseId={expense.id} name={expense.category} paid={paid} billingMonth={billingMonth} />
        </span>

        {state.error ? (
          <p role="alert" className={`mt-2 ${errorClass}`}>
            // {state.error}
          </p>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Compact list-view row for an expense (mirrors the debts list). The row body opens the editor;
 * the Pay/Revert pill lives outside that button so it isn't a nested interactive element.
 */
function ExpenseRow({
  expense,
  paid,
  billingMonth,
  income,
  onEdit,
}: {
  expense: Expense;
  paid: boolean;
  billingMonth: string;
  income: number;
  onEdit: () => void;
}) {
  const accent = paid ? "--color-accent-emerald" : groupAccent(expense.expense_group);
  const Icon = groupIcon(expense.expense_group);
  return (
    <li className="relative flex items-center gap-3 pl-5 pr-4">
      <span aria-hidden className="absolute left-0 top-0 h-full w-1" style={{ background: `var(${accent})` }} />
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${expense.category}`}
        className="flex min-w-0 flex-1 items-center gap-3 py-3 text-left"
      >
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-elevated)]"
          style={{ color: `var(${accent})` }}
        >
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span
              className={`truncate font-sans text-sm font-medium ${
                paid ? "text-[var(--color-text-muted)] line-through" : "text-[var(--color-text-primary)]"
              }`}
            >
              {expense.category}
            </span>
            {paid ? (
              <span className="shrink-0 rounded bg-[color-mix(in_oklab,var(--color-accent-emerald),transparent_85%)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--color-accent-emerald)]">
                Paid
              </span>
            ) : null}
          </span>
          <span className="mt-0.5 block truncate font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
            {expense.expense_group ? EXPENSE_GROUP_LABELS[expense.expense_group] : "Ungrouped"}
            {expense.due_day ? ` · ${paid ? "paid" : "pay day"} ${ordinal(expense.due_day)}` : ""}
            {expense.debt_id || expense.savings_goal_id ? " · linked" : ""}
          </span>
        </span>
        <span
          className={`shrink-0 font-sans text-base font-medium tabular-nums ${
            paid ? "text-[var(--color-text-muted)] line-through" : "text-[var(--color-text-primary)]"
          }`}
        >
          {formatUsd(expenseDisplayAmount(expense, income))}
        </span>
      </button>
      <span onClick={(e) => e.stopPropagation()} className="shrink-0">
        <PayToggle expenseId={expense.id} name={expense.category} paid={paid} billingMonth={billingMonth} compact />
      </span>
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

/** A recurring savings contribution as a checkable bill. Checking it off adds the amount to the pot. */
function SavingsBillCard({ bill, paid, billingMonth }: { bill: SavingsBill; paid: boolean; billingMonth: string }) {
  const [amount, setAmount] = useState(String(bill.monthly_contribution));
  const [, formAction] = useActionState(toggleSavingsPaid, INITIAL_FINANCE_STATE);
  return (
    <li className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-4">
      <form action={formAction}>
        <input type="hidden" name="item_id" value={bill.id} />
        <input type="hidden" name="billing_month" value={billingMonth} />

        <div className="flex min-w-0 items-start gap-3">
          <input
            type="checkbox"
            name="checked"
            aria-label={`Mark ${bill.name} contributed`}
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
            <p className="mt-0.5 font-mono text-[10px] tracking-[0.16em] text-[var(--color-text-muted)] uppercase">
              Savings · monthly
            </p>
          </div>
        </div>

        <label className="mt-3 block">
          <span className={inlineLabelClass}>Contribute $</span>
          <input
            name="amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label={`Contribution for ${bill.name}`}
            className={inlineFieldClass}
          />
        </label>
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

/** The Expenses right sidebar (stitch reference): this-month budget + spending breakdown,
 * the single income manager, and the subscriptions summary. */
function ExpensesRail({
  plan,
  budgetLeft,
  incomes,
  rail,
}: {
  plan: MonthlyPlan;
  budgetLeft: number;
  incomes: Income[];
  rail: ExpensesRail;
}) {
  const income = plan.income;
  // Segmented "where income goes" bar: expenses / offerings / leftover (clamped to income).
  const pctOf = (n: number) => (income > 0 ? Math.max(0, Math.min(100, (n / income) * 100)) : 0);

  const barTotal = plan.byGroup.reduce((s, g) => s + g.amount, 0);
  const breakdown = plan.byGroup
    .filter((g) => g.amount > 0)
    .map((g, i) => ({
      label: g.group,
      pct: barTotal > 0 ? (g.amount / barTotal) * 100 : 0,
      accentVar: RAIL_ACCENTS[i % RAIL_ACCENTS.length],
    }));

  return (
    <aside aria-label="This month" className="mt-6 space-y-6 lg:mt-0 lg:sticky lg:top-6">
      {/* THIS MONTH */}
      <section className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5">
        <p className={labelClass}>// this month</p>
        <dl className="mt-4 space-y-2.5 font-mono text-[12px]">
          <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-2.5">
            <dt className="text-[var(--color-text-secondary)]">Income</dt>
            <dd className="tabular-nums text-[var(--color-accent-emerald)]">+{formatUsd(income)}</dd>
          </div>
          <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-2.5">
            <dt className="text-[var(--color-text-secondary)]">Expenses</dt>
            <dd className="tabular-nums text-[var(--color-accent-red)]">−{formatUsd(plan.expenses)}</dd>
          </div>
          <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-2.5">
            <dt className="text-[var(--color-text-secondary)]">Giving</dt>
            <dd className="tabular-nums text-[var(--color-accent-purple)]">−{formatUsd(plan.offerings)}</dd>
          </div>
          <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-2.5">
            <dt className="text-[var(--color-text-secondary)]">Savings</dt>
            <dd className="tabular-nums text-[var(--color-accent-blue)]">−{formatUsd(rail.savingsMonthly)}</dd>
          </div>
          <div className="flex items-center justify-between pt-1">
            <dt className="font-sans text-sm font-medium text-[var(--color-text-primary)]">Budget left</dt>
            <dd
              className="font-sans text-xl font-medium tabular-nums"
              style={{ color: budgetLeft < 0 ? "var(--color-accent-red)" : "var(--color-text-primary)" }}
            >
              {formatUsd(budgetLeft)}
            </dd>
          </div>
        </dl>
        <div className="mt-3 flex h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-elevated)]">
          <div className="h-full bg-[var(--color-accent-red)]" style={{ width: `${pctOf(plan.expenses)}%` }} />
          <div className="h-full bg-[var(--color-accent-purple)]" style={{ width: `${pctOf(plan.offerings)}%` }} />
          <div className="h-full bg-[var(--color-accent-blue)]" style={{ width: `${pctOf(rail.savingsMonthly)}%` }} />
          <div className="h-full bg-[var(--color-accent-emerald)]" style={{ width: `${pctOf(Math.max(0, budgetLeft))}%` }} />
        </div>

        {breakdown.length > 0 ? (
          <div className="mt-6 border-t border-[var(--color-border-subtle)] pt-4">
            <p className={labelClass}>// spending breakdown</p>
            <ul className="mt-3 space-y-2">
              {breakdown.map((b) => (
                <li key={b.label} className="flex items-center justify-between gap-3 font-mono text-[11px]">
                  <span className="flex min-w-0 items-center gap-2 text-[var(--color-text-secondary)]">
                    <span className="size-2 shrink-0 rounded-full" style={{ background: `var(${b.accentVar})` }} aria-hidden />
                    <span className="truncate">{b.label}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-[var(--color-text-primary)]">{Math.round(b.pct)}%</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-[var(--color-elevated)]">
              {breakdown.map((b) => (
                <div key={b.label} className="h-full" style={{ width: `${b.pct}%`, background: `var(${b.accentVar})` }} />
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {/* INCOME SOURCES — the single income manager */}
      <IncomeRail incomes={incomes} />

      {/* SUBSCRIPTIONS */}
      <section className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5">
        <p className={labelClass}>// subscriptions</p>
        <p className="mt-3 font-sans text-2xl font-medium tabular-nums text-[var(--color-text-primary)]">
          {formatUsd(rail.subscriptionTotal)}
          <span className="ml-2 font-mono text-[11px] text-[var(--color-text-muted)]">/mo</span>
        </p>
        <p className="mt-1 font-mono text-[11px] text-[var(--color-text-secondary)]">
          {rail.subscriptionCount} active subscription{rail.subscriptionCount === 1 ? "" : "s"}
        </p>
      </section>
    </aside>
  );
}

/** Compact income manager for the rail (stitch reference): a row per source with an icon,
 * name + cadence, and the green monthly amount. The "+" / row-click open the full form in a modal. */
function IncomeRail({ incomes }: { incomes: Income[] }) {
  const [mode, setMode] = useState<{ kind: "list" } | { kind: "create" } | { kind: "edit"; id: string }>({
    kind: "list",
  });
  const toList = useCallback(() => setMode({ kind: "list" }), []);
  const editing = mode.kind === "edit" ? incomes.find((i) => i.id === mode.id) : undefined;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <p className={labelClass}>// income sources</p>
        <button
          type="button"
          onClick={() => setMode({ kind: "create" })}
          aria-label="Add income"
          className="text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-accent-emerald)]"
        >
          <Plus className="size-4" aria-hidden />
        </button>
      </div>

      {incomes.length === 0 ? (
        <p className="font-mono text-[11px] text-[var(--color-text-muted)]">// no income yet — add a paycheck</p>
      ) : (
        <ul aria-label="Income" className="space-y-2">
          {incomes.map((inc) => (
            <li key={inc.id}>
              <button
                type="button"
                onClick={() => setMode({ kind: "edit", id: inc.id })}
                aria-label={`Edit ${inc.source}`}
                className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-3 text-left transition-colors hover:border-[var(--color-border-strong)]"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden
                    className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_oklab,var(--color-accent-emerald),transparent_88%)] text-[var(--color-accent-emerald)]"
                  >
                    <Briefcase className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-sans text-sm font-medium text-[var(--color-text-primary)]">
                      {inc.source}
                    </span>
                    <span className="block font-mono text-[10px] text-[var(--color-text-muted)]">
                      {INCOME_CADENCE_LABELS[inc.cadence]}
                    </span>
                  </span>
                </span>
                <span className="flex shrink-0 items-baseline gap-1 font-mono text-[12px] tabular-nums text-[var(--color-accent-emerald)]">
                  <span className="text-[10px]">$</span>
                  {amountDigits(Number(inc.amount))}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* open tracks `editing` so archiving (which drops it from the live list) auto-closes the modal. */}
      <Modal
        open={mode.kind === "create" || editing != null}
        onClose={toList}
        label={mode.kind === "edit" ? "Edit income" : "New income"}
      >
        {mode.kind === "create" ? <IncomeForm onDone={toList} onCancel={toList} /> : null}
        {editing ? (
          <>
            <IncomeForm income={editing} onDone={toList} onCancel={toList} />
            {/* Archive lives in the editor (rows are buttons that open this modal). */}
            <div className="mt-4 flex justify-end">
              <IncomeArchiveButton id={editing.id} name={editing.source} />
            </div>
          </>
        ) : null}
      </Modal>
    </section>
  );
}

function IncomeArchiveButton({ id, name }: { id: string; name: string }) {
  const [state, formAction] = useActionState(archiveIncome, INITIAL_FINANCE_STATE);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(`Archive "${name}"? It'll be hidden from your income.`)) e.preventDefault();
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
