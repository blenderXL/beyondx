import { describe, it, expect } from "vitest";
import {
  validateIncomeInput,
  validateExpenseInput,
  validateSavingsGoalInput,
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
});
