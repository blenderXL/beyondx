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
  is_variable: false,
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
    expect(map["Min. debt payments"]).toBe(200);
  });

  it("splits income and outflow across pay cycles by day", () => {
    expect(plan.byCycle.first.income).toBe(3000); // Pay1 on day 1
    expect(plan.byCycle.mid.income).toBe(3000); // Pay2 on day 15
    expect(plan.byCycle.first.expenses).toBe(115); // Internet day 5
    expect(plan.byCycle.mid.expenses).toBe(66); // HOA day 20
    expect(plan.byCycle.first.minimums).toBe(200); // Tesla day 10
  });

  describe("variable income overrides", () => {
    it("uses a current-month override for a variable source, base otherwise", () => {
      const p = buildMonthlyPlan({
        incomes: [
          income({ source: "Gig", amount: 1000, is_variable: true }),
          income({ source: "Salary", amount: 4000, is_variable: false }),
        ],
        expenses: [],
        debts: [],
        overrides: { Gig: 2500 },
      });
      // Gig: override 2500 (not base 1000). Salary: base 4000 (no override).
      expect(p.income).toBe(6500);
    });

    it("ignores an override for a source that isn't flagged variable", () => {
      const p = buildMonthlyPlan({
        incomes: [income({ source: "Salary", amount: 4000, is_variable: false })],
        expenses: [],
        debts: [],
        overrides: { Salary: 9999 },
      });
      expect(p.income).toBe(4000);
    });

    it("falls back to base when a variable source has no override this month", () => {
      const p = buildMonthlyPlan({
        incomes: [income({ source: "Gig", amount: 1500, is_variable: true })],
        expenses: [],
        debts: [],
        overrides: {},
      });
      expect(p.income).toBe(1500);
    });

    it("applies the cadence multiplier to the override amount", () => {
      const p = buildMonthlyPlan({
        incomes: [income({ source: "Gig", amount: 500, cadence: "semimonthly", is_variable: true })],
        expenses: [],
        debts: [],
        overrides: { Gig: 800 }, // per-paycheck → ×2 for semimonthly
      });
      expect(p.income).toBe(1600);
    });

    it("percent offerings reflect the overridden income total", () => {
      const p = buildMonthlyPlan({
        incomes: [income({ source: "Gig", amount: 1000, pay_day: 1, is_variable: true })],
        expenses: [expense({ category: "Offering", amount: 0, due_day: 1, expense_group: "offering", pct_of_income: 10 })],
        debts: [],
        overrides: { Gig: 5000 },
      });
      expect(p.income).toBe(5000);
      expect(p.offerings).toBe(500); // 10% of the overridden 5000, not base 1000
    });
  });

  describe("one-time income", () => {
    it("counts a one-time source at full value in the current month", () => {
      const p = buildMonthlyPlan({
        incomes: [income({ source: "Bonus", amount: 7950.31, cadence: "one_time", pay_day: 1 })],
        expenses: [],
        debts: [],
      });
      expect(p.income).toBe(7950.31);
      expect(p.byCycle.first.income).toBe(7950.31);
    });

    it("includes a variable one-time source's override in the total (the $5,700 bug)", () => {
      // Mirrors the real account: a one-time variable 'Salary 1st' with this month's actual set,
      // plus two recurring sources. The headline must include all three, not drop the one-time.
      const p = buildMonthlyPlan({
        incomes: [
          income({ source: "Salary1", amount: 7950.31, cadence: "one_time", pay_day: 1, is_variable: true }),
          income({ source: "Salary15", amount: 3000, cadence: "monthly", pay_day: 15 }),
          income({ source: "Rental", amount: 2700, cadence: "monthly", pay_day: 1 }),
        ],
        expenses: [],
        debts: [],
        overrides: { Salary1: 7950.31 },
      });
      expect(p.income).toBe(13650.31);
    });
  });

  describe("one-time expenses", () => {
    it("counts a one-time expense at full value this month (symmetric with one-time income)", () => {
      const p = buildMonthlyPlan({
        incomes: [],
        expenses: [
          expense({ category: "Vet bill", amount: 700, cadence: "one_time", due_day: 16 }),
          expense({ category: "Internet", amount: 110.77, cadence: "monthly", due_day: 2 }),
        ],
        debts: [],
      });
      expect(p.expenses).toBe(810.77);
    });

    it("counts a one-time fixed offering this month", () => {
      const p = buildMonthlyPlan({
        incomes: [],
        expenses: [expense({ category: "Special gift", amount: 250, cadence: "one_time", due_day: 1, expense_group: "offering" })],
        debts: [],
      });
      expect(p.offerings).toBe(250);
    });
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
