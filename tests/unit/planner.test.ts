import { describe, it, expect } from "vitest";
import {
  monthlyFactor,
  monthlyAmount,
  monthlyTithe,
  cycleForDay,
  buildMonthlyPlan,
  type PlannerDebt,
} from "@/lib/finance/planner";
import type { Income, Expense } from "@/lib/finance/types";

const income = (over: Partial<Income> & { source: string; amount: number }): Income => ({
  id: over.source,
  profile_id: "p",
  cadence: "monthly",
  tithe_mode: "none",
  tithe_value: null,
  pay_day: null,
  archived_at: null,
  created_at: "",
  updated_at: "",
  ...over,
});

const expense = (over: Partial<Expense> & { category: string; amount: number }): Expense => ({
  id: over.category,
  profile_id: "p",
  cadence: "monthly",
  expense_group: null,
  payee: null,
  due_day: null,
  debt_id: null,
  pct_of_income: null,
  archived_at: null,
  created_at: "",
  updated_at: "",
  ...over,
});

describe("monthlyFactor / monthlyAmount", () => {
  it("normalizes each cadence to a monthly figure", () => {
    expect(monthlyAmount(100, "monthly")).toBe(100);
    expect(monthlyAmount(100, "semimonthly")).toBe(200);
    expect(monthlyAmount(120, "annual")).toBe(10);
    expect(monthlyAmount(300, "quarterly")).toBe(100);
    expect(monthlyAmount(100, "weekly")).toBeCloseTo(433.33, 1);
    expect(monthlyAmount(100, "biweekly")).toBeCloseTo(216.67, 1);
    expect(monthlyAmount(500, "one_time")).toBe(0);
    expect(monthlyFactor("monthly")).toBe(1);
  });
});

describe("monthlyTithe", () => {
  it("percent: a share of monthly income", () => {
    expect(monthlyTithe(income({ source: "S", amount: 3000, tithe_mode: "percent", tithe_value: 10 }))).toBe(300);
  });
  it("fixed: the amount per paycheck, scaled by cadence", () => {
    expect(monthlyTithe(income({ source: "S", amount: 3000, cadence: "semimonthly", tithe_mode: "fixed", tithe_value: 250 }))).toBe(500);
  });
  it("none: zero", () => {
    expect(monthlyTithe(income({ source: "S", amount: 3000, tithe_mode: "none", tithe_value: 99 }))).toBe(0);
  });
});

describe("cycleForDay", () => {
  it("splits the month into first (1–14), mid (15+), and none", () => {
    expect(cycleForDay(1)).toBe("first");
    expect(cycleForDay(14)).toBe("first");
    expect(cycleForDay(15)).toBe("mid");
    expect(cycleForDay(28)).toBe("mid");
    expect(cycleForDay(null)).toBe("none");
  });
});

describe("buildMonthlyPlan", () => {
  const incomes: Income[] = [
    income({ source: "Pay1", amount: 3000, pay_day: 1 }),
    income({ source: "Pay2", amount: 3000, pay_day: 15 }),
  ];
  // Offerings are now an expense group: 10% of $6,000 monthly income = $600.
  const expenses: Expense[] = [
    expense({ category: "Internet", amount: 115, due_day: 5, expense_group: "utility" }),
    expense({ category: "HOA", amount: 66, due_day: 20, expense_group: "insurance" }),
    expense({ category: "Tithe", amount: 0, due_day: 1, expense_group: "offering", pct_of_income: 10 }),
  ];
  const debts: PlannerDebt[] = [{ id: "d1", name: "Tesla", min_payment: 200, due_day: 10 }];

  const plan = buildMonthlyPlan({ incomes, expenses, debts });

  it("totals income, offerings, expenses, minimums, and budget-left", () => {
    expect(plan.income).toBe(6000);
    expect(plan.offerings).toBe(600);
    expect(plan.expenses).toBe(181);
    expect(plan.debtMinimums).toBe(200);
    expect(plan.leftover).toBe(6000 - 600 - 181 - 200);
  });

  it("rolls expenses up by group, plus offerings and debt minimums", () => {
    const map = Object.fromEntries(plan.byGroup.map((g) => [g.group, g.amount]));
    expect(map["Utility"]).toBe(115);
    expect(map["Insurance"]).toBe(66);
    expect(map["Offerings"]).toBe(600);
    expect(map["Debt minimums"]).toBe(200);
  });

  it("splits income and outflow across pay cycles by day", () => {
    expect(plan.byCycle.first.income).toBe(3000); // Pay1 on day 1
    expect(plan.byCycle.mid.income).toBe(3000); // Pay2 on day 15
    expect(plan.byCycle.first.expenses).toBe(115); // Internet day 5
    expect(plan.byCycle.mid.expenses).toBe(66); // HOA day 20
    expect(plan.byCycle.first.minimums).toBe(200); // Tesla day 10
  });

  it("counts an offering expense exactly once (no income-tithe double-count)", () => {
    // Income still carries a percent tithe (legacy field) AND there's a 10% offering expense.
    // Only the expense counts — offerings must be 10% of 4000 = 400, not 800.
    const p = buildMonthlyPlan({
      incomes: [income({ source: "P", amount: 4000, pay_day: 1, tithe_mode: "percent", tithe_value: 10 })],
      expenses: [expense({ category: "Offering", amount: 0, due_day: 1, expense_group: "offering", pct_of_income: 10 })],
      debts: [],
    });
    expect(p.offerings).toBe(400);
    expect(p.byGroup.filter((g) => g.group === "Offerings")).toHaveLength(1);
    expect(p.leftover).toBe(4000 - 400);
  });
});
