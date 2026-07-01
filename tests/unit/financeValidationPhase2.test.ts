import { describe, it, expect } from "vitest";
import {
  validateIncomeInput,
  validateExpenseInput,
  validateSavingsGoalInput,
  validateIncomeOverrideInput,
  validateContributionInput,
  validateCardInput,
} from "@/lib/finance/validation";

describe("validateIncomeInput", () => {
  const base = { source: "Salary 1st", amount: "3000", cadence: "semimonthly", tithe_mode: "none" };

  it("accepts a valid income with no tithe", () => {
    const r = validateIncomeInput(base);
    expect(r.ok).toBe(true);
    expect(r.values).toMatchObject({ source: "Salary 1st", amount: 3000, cadence: "semimonthly", tithe_mode: "none", tithe_value: null });
  });

  it("requires a source", () => {
    expect(validateIncomeInput({ ...base, source: "  " }).ok).toBe(false);
  });

  it("requires a numeric, non-negative amount", () => {
    expect(validateIncomeInput({ ...base, amount: "abc" }).ok).toBe(false);
    expect(validateIncomeInput({ ...base, amount: "-5" }).ok).toBe(false);
    expect(validateIncomeInput({ ...base, amount: "" }).ok).toBe(false);
  });

  it("rejects an invalid cadence", () => {
    expect(validateIncomeInput({ ...base, cadence: "hourly" }).ok).toBe(false);
  });

  it("percent tithe requires 0–100", () => {
    expect(validateIncomeInput({ ...base, tithe_mode: "percent", tithe_value: "10" }).values?.tithe_value).toBe(10);
    expect(validateIncomeInput({ ...base, tithe_mode: "percent", tithe_value: "150" }).ok).toBe(false);
    expect(validateIncomeInput({ ...base, tithe_mode: "percent", tithe_value: "" }).ok).toBe(false);
  });

  it("fixed tithe requires a non-negative money amount", () => {
    expect(validateIncomeInput({ ...base, tithe_mode: "fixed", tithe_value: "250" }).values?.tithe_value).toBe(250);
    expect(validateIncomeInput({ ...base, tithe_mode: "fixed", tithe_value: "-1" }).ok).toBe(false);
  });

  it("none tithe ignores any tithe_value", () => {
    expect(validateIncomeInput({ ...base, tithe_mode: "none", tithe_value: "99" }).values?.tithe_value).toBe(null);
  });

  it("pay_day must be 1–31 when present", () => {
    expect(validateIncomeInput({ ...base, pay_day: "15" }).values?.pay_day).toBe(15);
    expect(validateIncomeInput({ ...base, pay_day: "32" }).ok).toBe(false);
    expect(validateIncomeInput({ ...base, pay_day: "0" }).ok).toBe(false);
  });

  it("is_variable defaults to false and reads the checkbox", () => {
    expect(validateIncomeInput(base).values?.is_variable).toBe(false);
    expect(validateIncomeInput({ ...base, is_variable: "on" }).values?.is_variable).toBe(true);
    expect(validateIncomeInput({ ...base, is_variable: "true" }).values?.is_variable).toBe(true);
  });
});

describe("validateIncomeOverrideInput", () => {
  const base = {
    income_id: "11111111-2222-4333-8444-555555555555",
    billing_month: "2026-06-01",
    amount: "2500",
  };

  it("accepts a valid override", () => {
    const r = validateIncomeOverrideInput(base);
    expect(r.ok).toBe(true);
    expect(r.values).toMatchObject({
      income_id: "11111111-2222-4333-8444-555555555555",
      billing_month: "2026-06-01",
      amount: 2500,
    });
  });

  it("rejects a malformed income_id", () => {
    expect(validateIncomeOverrideInput({ ...base, income_id: "nope" }).ok).toBe(false);
  });

  it("rejects a non-ISO billing_month", () => {
    expect(validateIncomeOverrideInput({ ...base, billing_month: "June" }).ok).toBe(false);
  });

  it("requires a non-negative amount", () => {
    expect(validateIncomeOverrideInput({ ...base, amount: "" }).ok).toBe(false);
    expect(validateIncomeOverrideInput({ ...base, amount: "-1" }).ok).toBe(false);
  });
});

describe("validateExpenseInput", () => {
  const base = { category: "Internet", amount: "115", cadence: "monthly" };

  it("accepts a valid expense with group and payee", () => {
    const r = validateExpenseInput({ ...base, expense_group: "utility", payee: "Optimum", due_day: "5" });
    expect(r.ok).toBe(true);
    expect(r.values).toMatchObject({ category: "Internet", amount: 115, expense_group: "utility", payee: "Optimum", due_day: 5 });
  });

  it("requires a category", () => {
    expect(validateExpenseInput({ ...base, category: "" }).ok).toBe(false);
  });

  it("rejects an unknown expense_group", () => {
    expect(validateExpenseInput({ ...base, expense_group: "groceries" }).ok).toBe(false);
  });

  it("allows an omitted group/payee (null)", () => {
    const r = validateExpenseInput(base);
    expect(r.ok).toBe(true);
    expect(r.values?.expense_group).toBe(null);
    expect(r.values?.payee).toBe(null);
  });

  it("due_day must be 1–31 when present", () => {
    expect(validateExpenseInput({ ...base, due_day: "40" }).ok).toBe(false);
  });

  it("accepts the expanded groups (credit card, transportation, etc.)", () => {
    for (const g of ["credit_card", "transportation", "food", "healthcare", "personal"]) {
      expect(validateExpenseInput({ ...base, expense_group: g }).ok).toBe(true);
    }
  });

  it("accepts a UUID debt_id and defaults it to null when omitted", () => {
    const linked = validateExpenseInput({ ...base, debt_id: "11111111-2222-4333-8444-555555555555" });
    expect(linked.ok).toBe(true);
    expect(linked.values?.debt_id).toBe("11111111-2222-4333-8444-555555555555");
    expect(validateExpenseInput(base).values?.debt_id).toBe(null);
    expect(validateExpenseInput({ ...base, debt_id: "" }).values?.debt_id).toBe(null);
  });

  it("rejects a malformed debt_id", () => {
    expect(validateExpenseInput({ ...base, debt_id: "not-a-uuid" }).ok).toBe(false);
  });
});

describe("validateSavingsGoalInput", () => {
  it("accepts a named pot with optional target + current", () => {
    const r = validateSavingsGoalInput({ name: "Purge", target_amount: "5000", current_amount: "1380" });
    expect(r.ok).toBe(true);
    expect(r.values).toMatchObject({ name: "Purge", target_amount: 5000, current_amount: 1380 });
  });

  it("requires a name", () => {
    expect(validateSavingsGoalInput({ name: "" }).ok).toBe(false);
  });

  it("defaults current_amount to 0 and target to null", () => {
    const r = validateSavingsGoalInput({ name: "Emergency" });
    expect(r.values).toMatchObject({ name: "Emergency", target_amount: null, current_amount: 0 });
  });

  it("rejects negative amounts", () => {
    expect(validateSavingsGoalInput({ name: "X", current_amount: "-1" }).ok).toBe(false);
  });

  it("defaults type to general and accepts a valid type", () => {
    expect(validateSavingsGoalInput({ name: "X" }).values?.type).toBe("general");
    expect(validateSavingsGoalInput({ name: "X", type: "roth_ira" }).values?.type).toBe("roth_ira");
    expect(validateSavingsGoalInput({ name: "X", type: "crypto" }).ok).toBe(false);
  });

  it("recurring_kind=fixed keeps the monthly amount and nulls the percent", () => {
    const r = validateSavingsGoalInput({
      name: "X",
      recurring_kind: "fixed",
      monthly_contribution: "150",
      pct_of_income: "10",
    });
    expect(r.values).toMatchObject({ monthly_contribution: 150, pct_of_income: null });
  });

  it("recurring_kind=percent keeps the percent and nulls the monthly amount", () => {
    const r = validateSavingsGoalInput({
      name: "X",
      recurring_kind: "percent",
      monthly_contribution: "150",
      pct_of_income: "12.5",
    });
    expect(r.values).toMatchObject({ monthly_contribution: null, pct_of_income: 12.5 });
  });

  it("recurring_kind=none clears both recurring fields", () => {
    const r = validateSavingsGoalInput({ name: "X", recurring_kind: "none", monthly_contribution: "150" });
    expect(r.values).toMatchObject({ monthly_contribution: null, pct_of_income: null });
  });

  it("rejects an out-of-range percent", () => {
    expect(validateSavingsGoalInput({ name: "X", recurring_kind: "percent", pct_of_income: "150" }).ok).toBe(false);
  });
});

describe("validateContributionInput", () => {
  const base = { savings_goal_id: "11111111-2222-4333-8444-555555555555", amount: "250" };

  it("accepts a valid contribution", () => {
    const r = validateContributionInput(base);
    expect(r.ok).toBe(true);
    expect(r.values).toMatchObject({ savings_goal_id: base.savings_goal_id, amount: 250, occurred_on: null });
  });

  it("accepts an optional ISO date", () => {
    expect(validateContributionInput({ ...base, occurred_on: "2026-06-01" }).values?.occurred_on).toBe("2026-06-01");
    expect(validateContributionInput({ ...base, occurred_on: "nope" }).ok).toBe(false);
  });

  it("rejects a malformed pot id and non-positive amounts", () => {
    expect(validateContributionInput({ ...base, savings_goal_id: "x" }).ok).toBe(false);
    expect(validateContributionInput({ ...base, amount: "0" }).ok).toBe(false);
    expect(validateContributionInput({ ...base, amount: "-5" }).ok).toBe(false);
  });
});

describe("validateCardInput", () => {
  it("accepts a valid credit card", () => {
    const r = validateCardInput({ name: "Amex Gold", card_type: "credit" });
    expect(r.ok).toBe(true);
    expect(r.values).toEqual({ name: "Amex Gold", card_type: "credit" });
  });

  it("accepts debit and trims the name", () => {
    const r = validateCardInput({ name: "  Chase Debit  ", card_type: "debit" });
    expect(r.ok).toBe(true);
    expect(r.values).toEqual({ name: "Chase Debit", card_type: "debit" });
  });

  it("defaults a blank type to credit", () => {
    expect(validateCardInput({ name: "Visa", card_type: "" }).values?.card_type).toBe("credit");
  });

  it("requires a name", () => {
    expect(validateCardInput({ name: "  ", card_type: "credit" }).ok).toBe(false);
  });

  it("rejects an invalid type", () => {
    expect(validateCardInput({ name: "Visa", card_type: "gift" }).ok).toBe(false);
  });
});
