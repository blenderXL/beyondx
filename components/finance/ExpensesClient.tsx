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
  Banknote,
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
  CalendarDays,
  type LucideIcon,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { PayCalendar, type CalendarItem } from "@/components/finance/PayCalendar";
import { DebtDetail, type DebtTxn } from "@/components/finance/DebtDetail";
import {
  createExpense,
  updateExpense,
  archiveExpense,
  togglePaid,
  toggleSavingsPaid,
  payAllExpenses,
  revertAllExpenses,
  archiveIncome,
  archiveCard,
  setExpenseCard,
  setDebtCard,
} from "@/app/(app)/actions";
import { INITIAL_FINANCE_STATE, type FinanceActionState } from "@/lib/finance/actionState";
import {
  EXPENSE_CADENCES,
  EXPENSE_CADENCE_LABELS,
  EXPENSE_GROUPS,
  EXPENSE_GROUP_LABELS,
  INCOME_CADENCE_LABELS,
  CARD_TYPE_LABELS,
  DEBT_BUCKET_LABELS,
  typeBucket,
  type Card,
  type Debt,
  type Expense,
  type ExpenseGroup,
  type DebtType,
  type Income,
} from "@/lib/finance/types";
import {
  filterAndSortExpenses,
  partitionPaidLast,
  summarizeByCard,
  EXPENSE_SORTS,
  type ExpenseSort,
  type CardSummary,
} from "@/lib/finance/expensesView";
import { CardFormCard } from "@/components/finance/CardFormCard";
import { splitPayment } from "@/lib/finance/payment";
import type { MonthlyPlan } from "@/lib/finance/planner";
import { MonthSwitcher } from "@/components/finance/MonthSwitcher";
import { type MonthOption } from "@/lib/finance/history";
import { IncomeForm } from "@/components/finance/IncomeClient";
import { formatUsd, expenseDisplayAmount } from "@/lib/finance/derive";
import { bucketAccentVar } from "@/lib/finance/insights";
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
  /** Full next-due date (ISO), when set — lets the calendar skip a debt not due this month. */
  nextDueDate: string | null;
  /** Payment card this debt's payment is made on (migration 0022); null ⇒ unassigned. */
  card_id: string | null;
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
  cards,
  rail,
  income,
  billingMonth,
  paidExpenseIds,
  debtBills,
  debtRows,
  txnsByDebt,
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
  /** The user's payment cards, for the inline picker + the rail's per-card totals (migration 0021). */
  cards: Card[];
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
  /** The full debt rows behind the bills — powers the debt-detail modal (as on the Debts page). */
  debtRows: Debt[];
  /** Per-debt transaction lists for the detail modal (keyed by debt id). */
  txnsByDebt: Record<string, DebtTxn[]>;
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
  // Which debt bill's detail modal (full debt view + payment-card picker) is open.
  const [debtCardId, setDebtCardId] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

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
  // Debt + savings bills share the one bill grid. They honor the search box (name match) but not
  // the expense-group filter (their buckets aren't expense groups), so a specific group hides them.
  const q = query.trim().toLowerCase();
  const debtVisible = useMemo(
    () => (group === "all" ? debtBills.filter((b) => q === "" || b.name.toLowerCase().includes(q)) : []),
    [debtBills, group, q],
  );
  const savingsVisible = useMemo(
    () => (group === "all" ? savingsBills.filter((b) => q === "" || b.name.toLowerCase().includes(q)) : []),
    [savingsBills, group, q],
  );
  const noBillsMatch = orderedVisible.length === 0 && debtVisible.length === 0 && savingsVisible.length === 0;
  // Resolve the edit target from the live list so archiving it closes the modal.
  const editExpense = mode.kind === "edit" ? (expenses.find((e) => e.id === mode.id) ?? null) : null;
  // Full debt row behind the clicked bill — archiving it drops the row and closes the modal.
  const detailDebt = debtCardId ? (debtRows.find((d) => d.id === debtCardId) ?? null) : null;
  // THIS-MONTH budget math (user's formula): budget left = income − expenses − giving − savings
  // (no debt minimums). Savings = the planned monthly contributions to the user's savings goals.
  // Budget left = income minus every planned outflow this month, INCLUDING debt minimums — so it
  // goes negative when obligations exceed income (e.g. no income but debts due).
  const budgetLeft =
    Math.round(
      (plan.income - plan.expenses - plan.offerings - rail.savingsMonthly - plan.debtMinimums) * 100,
    ) / 100;
  // Per-card planned/paid rollup for the rail (migration 0021).
  const cardSummaries = useMemo(
    () =>
      summarizeByCard(
        expenses,
        cards,
        income,
        paid,
        debtBills.map((b) => ({ id: b.id, card_id: b.card_id, amount: b.min_payment })),
        paidDebt,
      ),
    [expenses, cards, income, paid, debtBills, paidDebt],
  );

  // Dated bills for the pay calendar — expenses + debt payments that carry a pay day.
  const calendarItems = useMemo<CalendarItem[]>(() => {
    const fromExpenses = expenses
      .filter((e) => e.due_day != null)
      .map((e) => ({ name: e.category, day: e.due_day!, amount: expenseDisplayAmount(e, income), paid: paid.has(e.id) }));
    // A debt with a full next-due date only belongs on the month it's due in (a stale/past date
    // still shows — the obligation recurs monthly); a bare legacy due_day always shows.
    const fromDebts = debtBills
      .filter((b) => b.dueDay != null && (!b.nextDueDate || b.nextDueDate.slice(0, 7) <= billingMonth.slice(0, 7)))
      .map((b) => ({ name: b.name, day: b.dueDay!, amount: b.min_payment, paid: paidDebt.has(b.id) }));
    return [...fromExpenses, ...fromDebts];
  }, [expenses, debtBills, income, paid, paidDebt, billingMonth]);

  return (
    <div className="mx-auto max-w-6xl">
      {/* Debt-style header: headline metric (budget left) on the left, controls on the right, divider. */}
      <header className="mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-[var(--color-border-subtle)] pb-6">
        <h1 className="sr-only">Your expenses</h1>
        <div>
          <p className={labelClass}>// budget left</p>
          <p
            className="mt-1 font-sans text-4xl font-medium tabular-nums"
            style={{ color: budgetLeft < 0 ? "var(--color-accent-red)" : "var(--color-text-primary)" }}
          >
            {formatUsd(budgetLeft)}
          </p>
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
            {/* Which payment card this bill is paid with — lives in the editor, not on the card face. */}
            {cards.length > 0 ? (
              <div className="mt-4">
                <span className={labelClass}>// paying with</span>
                <div className="mt-2">
                  <CardPicker
                    action={setExpenseCard}
                    itemId={editExpense.id}
                    currentCardId={editExpense.card_id}
                    label={`Payment card for ${editExpense.category}`}
                    cards={cards}
                  />
                </div>
              </div>
            ) : null}
            {/* Archive lives in the editor now (no buttons on the card). Sibling form — not nested. */}
            <div className="mt-4 flex justify-end">
              <ArchiveButton id={editExpense.id} name={editExpense.category} />
            </div>
          </>
        ) : null}
      </Modal>

      {/* Debt bill → the full debt detail (same as the Debts page), plus which card it's paid
          with — everything about the debt without a trip to the Debts page. */}
      <Modal open={detailDebt != null} onClose={() => setDebtCardId(null)} label="Debt details" size="4xl">
        {detailDebt ? (
          <>
            <DebtDetail
              debt={detailDebt}
              txns={txnsByDebt[detailDebt.id] ?? []}
              onClose={() => setDebtCardId(null)}
            />
            <div className="mt-6 max-w-sm">
              <span className={labelClass}>// paying with</span>
              {cards.length > 0 ? (
                <div className="mt-2">
                  <CardPicker
                    action={setDebtCard}
                    itemId={detailDebt.id}
                    currentCardId={detailDebt.card_id ?? null}
                    label={`Payment card for ${detailDebt.name}`}
                    cards={cards}
                  />
                </div>
              ) : (
                <p className="mt-2 font-mono text-[11px] text-[var(--color-text-muted)]">
                  // add a card first — use the + in the Cards panel
                </p>
              )}
            </div>
          </>
        ) : null}
      </Modal>

      {/* Full-width toolbar above the bills + rail grid (debt-page structure). */}
      {expenses.length > 0 ? (
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
      ) : null}

      <div className="lg:grid lg:grid-cols-[1fr_19rem] lg:items-start lg:gap-6">
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
              {noBillsMatch ? (
                <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-strong)] p-10 text-center">
                  <p className="font-mono text-sm text-[var(--color-text-muted)]">
                    // no bills match your search or filter
                  </p>
                </div>
              ) : view === "category" ? (
                <>
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
                  {debtVisible.length + savingsVisible.length > 0 ? (
                    <ul aria-label="Bills" className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {debtVisible.map((b) => (
                        <DebtBillCard key={`debt-${b.id}`} bill={b} paid={paidDebt.has(b.id)} billingMonth={billingMonth} onEdit={() => setDebtCardId(b.id)} />
                      ))}
                      {savingsVisible.map((b) => (
                        <SavingsBillCard key={`sav-${b.id}`} bill={b} paid={paidSavings.has(b.id)} billingMonth={billingMonth} />
                      ))}
                    </ul>
                  ) : null}
                </>
              ) : view === "list" ? (
                <>
                  {orderedVisible.length > 0 ? (
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
                  ) : null}
                  {debtVisible.length + savingsVisible.length > 0 ? (
                    <ul aria-label="Bills" className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {debtVisible.map((b) => (
                        <DebtBillCard key={`debt-${b.id}`} bill={b} paid={paidDebt.has(b.id)} billingMonth={billingMonth} onEdit={() => setDebtCardId(b.id)} />
                      ))}
                      {savingsVisible.map((b) => (
                        <SavingsBillCard key={`sav-${b.id}`} bill={b} paid={paidSavings.has(b.id)} billingMonth={billingMonth} />
                      ))}
                    </ul>
                  ) : null}
                </>
              ) : (
                /* Card view — every bill (expenses + debt payments + savings) in one grid. */
                <ul aria-label="Bills" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {orderedVisible.map((expense) => (
                    <ExpenseCard
                      key={`exp-${expense.id}`}
                      expense={expense}
                      paid={paid.has(expense.id)}
                      billingMonth={billingMonth}
                      incomeBreakdown={incomeBreakdown}
                      onEdit={() => setMode({ kind: "edit", id: expense.id })}
                    />
                  ))}
                  {debtVisible.map((b) => (
                    <DebtBillCard key={`debt-${b.id}`} bill={b} paid={paidDebt.has(b.id)} billingMonth={billingMonth} onEdit={() => setDebtCardId(b.id)} />
                  ))}
                  {savingsVisible.map((b) => (
                    <SavingsBillCard key={`sav-${b.id}`} bill={b} paid={paidSavings.has(b.id)} billingMonth={billingMonth} />
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {/* Right: the stitch sidebar — budget, breakdown, income, subscriptions */}
        <ExpensesRail
          plan={plan}
          budgetLeft={budgetLeft}
          incomes={incomes}
          rail={rail}
          cards={cards}
          cardSummaries={cardSummaries}
        />
      </div>

      {/* Floating pay-calendar button (bottom-right) → month view of when bills are due. */}
      <button
        type="button"
        onClick={() => setCalendarOpen(true)}
        aria-label="Open pay calendar"
        className="fixed bottom-6 right-6 z-30 flex size-12 items-center justify-center rounded-full border border-[var(--color-border-strong)] bg-[var(--color-elevated)] text-[var(--color-text-primary)] shadow-lg transition-colors hover:border-[var(--color-text-primary)]"
      >
        <CalendarDays className="size-5" aria-hidden />
      </button>
      <Modal open={calendarOpen} onClose={() => setCalendarOpen(false)} label="Pay calendar" size="2xl">
        <PayCalendar items={calendarItems} billingMonth={billingMonth} />
      </Modal>
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
  // One sharp control height shared across the toolbar (matches the debts toolbar exactly).
  const ctrl =
    "h-9 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] font-mono text-[12px] text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-text-primary)]";
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
          className={`${ctrl} w-full pl-9 pr-3 placeholder:text-[var(--color-text-muted)]`}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
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

        <div className="flex h-9 shrink-0 items-center rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] p-0.5">
          {(
            [
              { v: "card" as const, Icon: LayoutGrid, label: "Card view" },
              { v: "list" as const, Icon: List, label: "List view" },
              { v: "category" as const, Icon: Layers, label: "Group by category" },
            ]
          ).map(({ v, Icon, label }) => (
            <button
              key={v}
              type="button"
              onClick={() => onView(v)}
              aria-label={label}
              aria-pressed={view === v}
              className={`flex size-8 items-center justify-center rounded ${
                view === v
                  ? "bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              }`}
            >
              <Icon className="size-4" aria-hidden />
            </button>
          ))}
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

/**
 * Pay-now / Revert submit button for a bill FORM that already carries the item's hidden fields
 * (kind, item_id, billing_month, amount). Unlike PayToggle it isn't its own form — it drops into
 * the debt/savings card forms so every bill shares one "Pay now" affordance (no checkboxes).
 */
function PayNowSubmit({ paid, name, pending }: { paid: boolean; name: string; pending?: boolean }) {
  return (
    <>
      {!paid ? <input type="hidden" name="checked" value="on" /> : null}
      <button
        type="submit"
        disabled={pending}
        aria-label={paid ? `Revert ${name}` : `Pay ${name}`}
        className={
          paid
            ? "flex w-full items-center justify-center gap-2 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)] disabled:opacity-40"
            : "flex w-full items-center justify-center gap-2 rounded-md border border-[color-mix(in_oklab,var(--color-accent-red),transparent_70%)] bg-[var(--color-elevated)] py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-accent-red)] transition-colors hover:bg-[color-mix(in_oklab,var(--color-accent-red),transparent_88%)] disabled:opacity-40"
        }
      >
        {pending ? "…" : paid ? (<><Undo2 className="size-3.5" aria-hidden /> Revert</>) : (<><CreditCard className="size-3.5" aria-hidden /> Pay now</>)}
      </button>
    </>
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
    <li className="h-full">
      <div
        onClick={onEdit}
        className={`group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5 pl-6 transition-colors hover:border-[var(--color-border-strong)] ${
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
        <span onClick={stop} className="mt-auto block pt-4">
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
 * Inline payment-card picker (migration 0021). A styled native select that auto-submits
 * `setExpenseCard` on change — blank clears the tag. Wrapped by callers in a stop-propagation
 * span so choosing a card doesn't open the expense editor.
 */
function CardPicker({
  action,
  itemId,
  currentCardId,
  label,
  cards,
}: {
  action: (prev: FinanceActionState, formData: FormData) => Promise<FinanceActionState>;
  itemId: string;
  currentCardId: string | null | undefined;
  label: string;
  cards: Card[];
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_FINANCE_STATE);
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={itemId} />
      <label className="sr-only" htmlFor={`card-${itemId}`}>
        {label}
      </label>
      <div className="relative">
        <select
          id={`card-${itemId}`}
          name="card_id"
          defaultValue={currentCardId ?? ""}
          disabled={pending}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="h-11 w-full appearance-none rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] pl-3 pr-8 font-mono text-sm text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-text-primary)] disabled:opacity-50"
        >
          <option value="">No card</option>
          {cards.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-[var(--color-text-muted)]"
          aria-hidden
        />
      </div>
      {state.error ? (
        <span role="alert" className={`mt-1 block ${errorClass}`}>
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

/** "due Aug 1" when the debt carries a full next-due date; "due 1" for a bare legacy day. */
function debtDueLabel(bill: DebtBill): string | null {
  if (bill.nextDueDate) {
    const d = new Date(`${bill.nextDueDate}T00:00:00Z`);
    return `due ${d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`;
  }
  return bill.dueDay ? `due ${bill.dueDay}` : null;
}

/**
 * A recurring debt obligation as a checkable bill. The payment defaults to the minimum and is
 * editable for the month; checking off records the payment and draws the balance down by the
 * principal portion (shown live as you edit the amount).
 */
function DebtBillCard({
  bill,
  paid,
  billingMonth,
  onEdit,
}: {
  bill: DebtBill;
  paid: boolean;
  billingMonth: string;
  /** Open the debt-detail modal (full debt view + which card it's paid with). */
  onEdit?: () => void;
}) {
  const [amount, setAmount] = useState(String(bill.min_payment));
  const [, formAction, pending] = useActionState(togglePaid, INITIAL_FINANCE_STATE);
  const n = Number(amount);
  const split = splitPayment({
    balance: bill.balance,
    apr: bill.apr,
    total: Number.isFinite(n) ? n : 0,
    escrow: bill.escrow ?? 0,
    pmi: bill.pmi ?? 0,
  });
  const extras = split.escrow + split.pmi;
  const [editing, setEditing] = useState(false);
  const payShown = Number.isFinite(n) ? n : 0;
  // Match the Debts-page card: colored left accent stripe + bucket label (paid ⇒ emerald).
  const accent = paid ? "--color-accent-emerald" : bucketAccentVar(bill.type);

  return (
    <li className="relative flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5 pl-6">
      <span aria-hidden className="absolute left-0 top-0 h-full w-1" style={{ background: `var(${accent})` }} />
      <form action={formAction} className="flex h-full flex-col">
        <input type="hidden" name="kind" value="debt" />
        <input type="hidden" name="item_id" value={bill.id} />
        <input type="hidden" name="billing_month" value={billingMonth} />
        {/* Amount rides as a hidden field so Pay now submits it even when not editing. */}
        <input type="hidden" name="amount" value={amount} />

        {/* Body click opens the debt-detail modal; the inline amount editor stops propagation. */}
        <div onClick={onEdit} className={onEdit ? "cursor-pointer" : undefined}>
          {/* Header — category + subdued due on one line (like DebtCard), name below. */}
          <p
            className="pr-7 font-mono text-[10px] tracking-[0.16em] uppercase"
            style={{ color: `var(${accent})` }}
          >
            {DEBT_BUCKET_LABELS[typeBucket(bill.type)]}
            {debtDueLabel(bill) ? (
              <span className="text-[var(--color-text-muted)]"> · {debtDueLabel(bill)}</span>
            ) : null}
          </p>
          <p
            className={`mt-1 font-sans text-base font-medium break-words ${
              paid ? "text-[var(--color-text-muted)] line-through" : "text-[var(--color-text-primary)]"
            }`}
          >
            {bill.name}
          </p>

          {/* Stat grid mirrors DebtCard. The pay amount shows as text; click it to edit inline. */}
          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 font-mono text-[11px]">
          <div>
            <dt className="uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Pay</dt>
            <dd className="mt-0.5">
              {editing ? (
                <input
                  autoFocus
                  inputMode="decimal"
                  value={amount}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setAmount(e.target.value)}
                  onBlur={() => setEditing(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "Escape") {
                      e.preventDefault();
                      setEditing(false);
                    }
                  }}
                  aria-label={`Payment for ${bill.name}`}
                  className="h-6 w-full rounded border border-[var(--color-border-strong)] bg-[var(--color-elevated)] px-1 text-sm tabular-nums text-[var(--color-text-primary)] outline-none focus:border-[var(--color-text-primary)]"
                />
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditing(true);
                  }}
                  aria-label={`Edit payment for ${bill.name}`}
                  className="text-sm tabular-nums text-[var(--color-text-primary)] transition-colors hover:text-[var(--color-accent-emerald)]"
                >
                  {formatUsd(payShown)}
                </button>
              )}
            </dd>
          </div>
          <div>
            <dt className="uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Principal</dt>
            <dd className="mt-0.5 text-sm tabular-nums text-[var(--color-text-primary)]">{formatUsd(split.principal)}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Interest</dt>
            <dd className="mt-0.5 text-sm tabular-nums text-[var(--color-text-primary)]">{formatUsd(split.interest)}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Balance</dt>
            <dd className="mt-0.5 text-sm tabular-nums text-[var(--color-text-primary)]">{formatUsd(bill.balance)}</dd>
          </div>
          {extras > 0 ? (
            <div>
              <dt className="uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Esc/PMI</dt>
              <dd className="mt-0.5 text-sm tabular-nums text-[var(--color-text-primary)]">{formatUsd(extras)}</dd>
            </div>
          ) : null}
          </dl>
        </div>

        <div className="mt-auto pt-5" onClick={(e) => e.stopPropagation()}>
          <PayNowSubmit paid={paid} name={bill.name} pending={pending} />
        </div>
      </form>
    </li>
  );
}

/** A recurring savings contribution as a checkable bill. Checking it off adds the amount to the pot. */
function SavingsBillCard({ bill, paid, billingMonth }: { bill: SavingsBill; paid: boolean; billingMonth: string }) {
  const [amount, setAmount] = useState(String(bill.monthly_contribution));
  const [, formAction, pending] = useActionState(toggleSavingsPaid, INITIAL_FINANCE_STATE);
  // Savings cards read emerald across the app; match the Debts-card stripe + label treatment.
  const accent = "--color-accent-emerald";
  const [editing, setEditing] = useState(false);
  const n = Number(amount);
  const contribShown = Number.isFinite(n) ? n : 0;
  return (
    <li className="relative flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5 pl-6">
      <span aria-hidden className="absolute left-0 top-0 h-full w-1" style={{ background: `var(${accent})` }} />
      <form action={formAction} className="flex h-full flex-col">
        <input type="hidden" name="item_id" value={bill.id} />
        <input type="hidden" name="billing_month" value={billingMonth} />
        <input type="hidden" name="amount" value={amount} />

        <p
          className="font-mono text-[10px] tracking-[0.16em] uppercase"
          style={{ color: `var(${accent})` }}
        >
          Savings <span className="text-[var(--color-text-muted)]">· monthly</span>
        </p>
        <p
          className={`mt-1 font-sans text-base font-medium break-words ${
            paid ? "text-[var(--color-text-muted)] line-through" : "text-[var(--color-text-primary)]"
          }`}
        >
          {bill.name}
        </p>

        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 font-mono text-[11px]">
          <div>
            <dt className="uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Contribute</dt>
            <dd className="mt-0.5">
              {editing ? (
                <input
                  autoFocus
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onBlur={() => setEditing(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "Escape") {
                      e.preventDefault();
                      setEditing(false);
                    }
                  }}
                  aria-label={`Contribution for ${bill.name}`}
                  className="h-6 w-full rounded border border-[var(--color-border-strong)] bg-[var(--color-elevated)] px-1 text-sm tabular-nums text-[var(--color-text-primary)] outline-none focus:border-[var(--color-text-primary)]"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  aria-label={`Edit contribution for ${bill.name}`}
                  className="text-sm tabular-nums text-[var(--color-text-primary)] transition-colors hover:text-[var(--color-accent-emerald)]"
                >
                  {formatUsd(contribShown)}
                </button>
              )}
            </dd>
          </div>
        </dl>

        <div className="mt-auto pt-5">
          <PayNowSubmit paid={paid} name={bill.name} pending={pending} />
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

/** Stable per-card accent, cycled by the card's position in the list. */
function cardAccent(index: number): string {
  return RAIL_ACCENTS[index % RAIL_ACCENTS.length]!;
}

/** The Expenses right sidebar (stitch reference): this-month budget + spending breakdown,
 * the single income manager, and the subscriptions summary. */
function ExpensesRail({
  plan,
  budgetLeft,
  incomes,
  rail,
  cards,
  cardSummaries,
}: {
  plan: MonthlyPlan;
  budgetLeft: number;
  incomes: Income[];
  rail: ExpensesRail;
  cards: Card[];
  cardSummaries: CardSummary[];
}) {
  const income = plan.income;
  // Total planned outflow this month — the mirror of "budget left" (expenses + giving + savings).
  const totalPlanned =
    Math.round((plan.expenses + plan.offerings + rail.savingsMonthly + plan.debtMinimums) * 100) / 100;
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
          <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-2.5">
            <dt className="text-[var(--color-text-secondary)]">Debt payments</dt>
            <dd className="tabular-nums text-[var(--color-accent-amber)]">−{formatUsd(plan.debtMinimums)}</dd>
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
          <div className="flex items-center justify-between border-t border-[var(--color-border-subtle)] pt-2.5">
            <dt className="text-[var(--color-text-muted)]">Total expenses planned</dt>
            <dd className="tabular-nums text-[var(--color-text-secondary)]">{formatUsd(totalPlanned)}</dd>
          </div>
        </dl>
        <div className="mt-3 flex h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-elevated)]">
          <div className="h-full bg-[var(--color-accent-red)]" style={{ width: `${pctOf(plan.expenses)}%` }} />
          <div className="h-full bg-[var(--color-accent-purple)]" style={{ width: `${pctOf(plan.offerings)}%` }} />
          <div className="h-full bg-[var(--color-accent-blue)]" style={{ width: `${pctOf(rail.savingsMonthly)}%` }} />
          <div className="h-full bg-[var(--color-accent-amber)]" style={{ width: `${pctOf(plan.debtMinimums)}%` }} />
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

      {/* PAYMENT CARDS — manage cards + per-card planned totals (migration 0021) */}
      <CardsRail cards={cards} summaries={cardSummaries} />

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

/**
 * Payment-cards manager + per-card planned totals for the rail (migration 0021). Mirrors
 * `IncomeRail`: a row per card (credit/debit icon, name, this-month planned total with a muted
 * "paid" sub-line and bill count), a "+" to add, and row-click to edit/archive in a modal. A
 * trailing dashed "Unassigned" row shows expenses with no card. Totals come from `summarizeByCard`.
 */
function CardsRail({ cards, summaries }: { cards: Card[]; summaries: CardSummary[] }) {
  const [mode, setMode] = useState<{ kind: "list" } | { kind: "create" } | { kind: "edit"; id: string }>({
    kind: "list",
  });
  const toList = useCallback(() => setMode({ kind: "list" }), []);
  const editing = mode.kind === "edit" ? cards.find((c) => c.id === mode.id) : undefined;
  const indexById = useMemo(() => new Map(cards.map((c, i) => [c.id, i])), [cards]);

  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className={labelClass}>// cards</p>
        <button
          type="button"
          onClick={() => setMode({ kind: "create" })}
          aria-label="New card"
          className="text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-accent-blue)]"
        >
          <Plus className="size-4" aria-hidden />
        </button>
      </div>

      {cards.length === 0 ? (
        <p className="font-mono text-[11px] text-[var(--color-text-muted)]">
          // no cards yet — add one to tag expenses
        </p>
      ) : (
        <ul aria-label="Cards" className="space-y-2">
          {summaries.map((s) => {
            const card = s.cardId ? cards.find((c) => c.id === s.cardId) : null;
            const accent = card ? cardAccent(indexById.get(card.id) ?? 0) : "--color-border-strong";
            const Icon = card ? (card.card_type === "debit" ? Banknote : CreditCard) : Wallet;
            const label = card ? card.name : "Unassigned";
            const sub = card
              ? `${CARD_TYPE_LABELS[card.card_type]} · ${s.count} bill${s.count === 1 ? "" : "s"}`
              : `${s.count} bill${s.count === 1 ? "" : "s"}`;
            const body = (
              <>
                <span className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden
                    className="flex size-8 shrink-0 items-center justify-center rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-elevated)]"
                    style={{ color: `var(${accent})` }}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-sans text-sm font-medium text-[var(--color-text-primary)]">
                      {label}
                    </span>
                    <span className="block font-mono text-[10px] text-[var(--color-text-muted)]">{sub}</span>
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-mono text-[12px] tabular-nums text-[var(--color-text-primary)]">
                    {formatUsd(s.planned)}
                  </span>
                  {s.paid > 0 ? (
                    <span className="block font-mono text-[10px] tabular-nums text-[var(--color-text-muted)]">
                      {formatUsd(s.paid)} paid
                    </span>
                  ) : null}
                </span>
              </>
            );
            return (
              <li key={s.cardId ?? "unassigned"}>
                {card ? (
                  <button
                    type="button"
                    onClick={() => setMode({ kind: "edit", id: card.id })}
                    aria-label={`Edit ${card.name}`}
                    className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-3 text-left transition-colors hover:border-[var(--color-border-strong)]"
                  >
                    {body}
                  </button>
                ) : (
                  <div className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-subtle)] p-3">
                    {body}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* open tracks `editing` so archiving (which drops it from the live list) auto-closes the modal. */}
      <Modal
        open={mode.kind === "create" || editing != null}
        onClose={toList}
        label={mode.kind === "edit" ? "Edit card" : "New card"}
      >
        {mode.kind === "create" ? <CardFormCard onDone={toList} onCancel={toList} /> : null}
        {editing ? (
          <>
            <CardFormCard card={editing} onDone={toList} onCancel={toList} />
            <div className="mt-4 flex justify-end">
              <CardArchiveButton id={editing.id} name={editing.name} />
            </div>
          </>
        ) : null}
      </Modal>
    </section>
  );
}

function CardArchiveButton({ id, name }: { id: string; name: string }) {
  const [state, formAction] = useActionState(archiveCard, INITIAL_FINANCE_STATE);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(`Archive "${name}"? Expenses tagged to it become unassigned.`)) e.preventDefault();
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
