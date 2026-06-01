/**
 * Pure monthly-planner engine (Phase 3) — the spreadsheet's calculation, made
 * deterministic. Normalizes every income/expense to a monthly figure, computes
 * offerings per income, rolls expenses up by group, and splits income/outflow across
 * the two pay cycles (1st-of-month vs 15th). No I/O, no dates.
 */

import { round2 } from "./validation";
import { EXPENSE_GROUP_LABELS, type Expense, type Income, type IncomeCadence, type ExpenseCadence } from "./types";

type Cadence = IncomeCadence | ExpenseCadence;

/** How many times a cadence occurs per month (also the monthly-amount multiplier). */
export function monthlyFactor(cadence: Cadence): number {
  switch (cadence) {
    case "weekly":
      return 52 / 12;
    case "biweekly":
      return 26 / 12;
    case "semimonthly":
      return 2;
    case "monthly":
      return 1;
    case "quarterly":
      return 1 / 3;
    case "annual":
      return 1 / 12;
    case "one_time":
      return 0;
    default:
      return 1;
  }
}

export function monthlyAmount(amount: number, cadence: Cadence): number {
  return round2(amount * monthlyFactor(cadence));
}

/** Monthly offering: a share of monthly income (percent) or the per-paycheck $ scaled by cadence. */
export function monthlyTithe(income: Pick<Income, "amount" | "cadence" | "tithe_mode" | "tithe_value">): number {
  if (income.tithe_mode === "percent") {
    return round2((monthlyAmount(income.amount, income.cadence) * (income.tithe_value ?? 0)) / 100);
  }
  if (income.tithe_mode === "fixed") {
    return round2((income.tithe_value ?? 0) * monthlyFactor(income.cadence));
  }
  return 0;
}

export type Cycle = "first" | "mid" | "none";

/** Day 1–14 → the 1st-of-month cycle; 15+ → the 15th cycle; no day → unscheduled. */
export function cycleForDay(day: number | null | undefined): Cycle {
  if (day === null || day === undefined) return "none";
  return day <= 14 ? "first" : "mid";
}

export interface PlannerDebt {
  id: string;
  name: string;
  min_payment: number;
  due_day: number | null;
}

export interface CycleBreakdown {
  income: number;
  offerings: number;
  expenses: number;
  minimums: number;
  outflow: number;
  leftover: number;
}

export interface MonthlyPlan {
  income: number;
  offerings: number;
  expenses: number;
  debtMinimums: number;
  leftover: number;
  byGroup: { group: string; amount: number }[];
  byCycle: Record<Cycle, CycleBreakdown>;
}

function emptyCycle(): CycleBreakdown {
  return { income: 0, offerings: 0, expenses: 0, minimums: 0, outflow: 0, leftover: 0 };
}

export function buildMonthlyPlan(inputs: {
  incomes: Income[];
  expenses: Expense[];
  debts: PlannerDebt[];
}): MonthlyPlan {
  const { incomes, expenses, debts } = inputs;
  const byCycle: Record<Cycle, CycleBreakdown> = {
    first: emptyCycle(),
    mid: emptyCycle(),
    none: emptyCycle(),
  };

  let income = 0;
  let offerings = 0;
  for (const inc of incomes) {
    const m = monthlyAmount(inc.amount, inc.cadence);
    const t = monthlyTithe(inc);
    income = round2(income + m);
    offerings = round2(offerings + t);
    const c = cycleForDay(inc.pay_day);
    byCycle[c].income = round2(byCycle[c].income + m);
    byCycle[c].offerings = round2(byCycle[c].offerings + t);
  }

  let expensesTotal = 0;
  const groupTotals = new Map<string, number>();
  for (const exp of expenses) {
    const m = monthlyAmount(exp.amount, exp.cadence);
    expensesTotal = round2(expensesTotal + m);
    const label = exp.expense_group ? EXPENSE_GROUP_LABELS[exp.expense_group] : "Ungrouped";
    groupTotals.set(label, round2((groupTotals.get(label) ?? 0) + m));
    const c = cycleForDay(exp.due_day);
    byCycle[c].expenses = round2(byCycle[c].expenses + m);
  }

  let debtMinimums = 0;
  for (const d of debts) {
    debtMinimums = round2(debtMinimums + d.min_payment);
    const c = cycleForDay(d.due_day);
    byCycle[c].minimums = round2(byCycle[c].minimums + d.min_payment);
  }

  // Finalize per-cycle outflow + leftover.
  for (const c of ["first", "mid", "none"] as Cycle[]) {
    const b = byCycle[c];
    b.outflow = round2(b.offerings + b.expenses + b.minimums);
    b.leftover = round2(b.income - b.outflow);
  }

  const byGroup = [
    ...[...groupTotals.entries()].map(([group, amount]) => ({ group, amount })),
    { group: "Offerings", amount: offerings },
    { group: "Debt minimums", amount: debtMinimums },
  ].filter((g) => g.amount > 0);

  const leftover = round2(income - offerings - expensesTotal - debtMinimums);

  return { income, offerings, expenses: expensesTotal, debtMinimums, leftover, byGroup, byCycle };
}
