import { describe, it, expect } from "vitest";
import {
  filterAndSortExpenses,
  partitionPaidLast,
  EXPENSE_SORTS,
  type ExpenseViewOptions,
} from "@/lib/finance/expensesView";
import type { Expense } from "@/lib/finance/types";

const exp = (over: Partial<Expense> & { category: string }): Expense => ({
  id: over.category,
  profile_id: "p",
  amount: 0,
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

const opts = (over: Partial<ExpenseViewOptions> = {}): ExpenseViewOptions => ({
  query: "",
  group: "all",
  sort: "amount_desc",
  ...over,
});

const internet = exp({ category: "Internet", amount: 110, payee: "Optimum", expense_group: "utility", due_day: 1 });
const water = exp({ category: "Water", amount: 60, payee: "Mustang", expense_group: "utility", due_day: 16 });
const claude = exp({ category: "Claude", amount: 100, payee: "Anthropic", expense_group: "subscription", due_day: 4 });

describe("filterAndSortExpenses", () => {
  it("matches the query against name and payee (case-insensitive)", () => {
    expect(filterAndSortExpenses([internet, water, claude], opts({ query: "optim" })).map((e) => e.category)).toEqual(["Internet"]);
    expect(filterAndSortExpenses([internet, water, claude], opts({ query: "WATER" })).map((e) => e.category)).toEqual(["Water"]);
  });

  it("filters by expense group", () => {
    expect(
      filterAndSortExpenses([internet, water, claude], opts({ group: "subscription" })).map((e) => e.category),
    ).toEqual(["Claude"]);
    expect(filterAndSortExpenses([internet, water, claude], opts({ group: "utility" })).map((e) => e.category).sort()).toEqual([
      "Internet",
      "Water",
    ]);
  });

  it("sorts by amount high→low and low→high", () => {
    expect(filterAndSortExpenses([water, internet, claude], opts({ sort: "amount_desc" })).map((e) => e.category)).toEqual([
      "Internet",
      "Claude",
      "Water",
    ]);
    expect(filterAndSortExpenses([water, internet, claude], opts({ sort: "amount_asc" })).map((e) => e.category)).toEqual([
      "Water",
      "Claude",
      "Internet",
    ]);
  });

  it("sorts by name A→Z and by pay day soonest", () => {
    expect(filterAndSortExpenses([water, internet, claude], opts({ sort: "name_asc" })).map((e) => e.category)).toEqual([
      "Claude",
      "Internet",
      "Water",
    ]);
    expect(filterAndSortExpenses([water, internet, claude], opts({ sort: "payday_asc" })).map((e) => e.category)).toEqual([
      "Internet",
      "Claude",
      "Water",
    ]);
  });

  it("doesn't mutate the input array", () => {
    const input = [water, internet];
    filterAndSortExpenses(input, opts({ sort: "amount_desc" }));
    expect(input.map((e) => e.category)).toEqual(["Water", "Internet"]);
  });

  it("exposes a labeled sort list", () => {
    expect(EXPENSE_SORTS.map((s) => s.value)).toContain("amount_desc");
    expect(EXPENSE_SORTS.every((s) => typeof s.label === "string")).toBe(true);
  });
});

describe("partitionPaidLast", () => {
  it("moves paid items to the end, preserving order within each partition", () => {
    const paid = new Set([internet.id, claude.id]);
    expect(partitionPaidLast([internet, water, claude], paid).map((e) => e.category)).toEqual([
      "Water",
      "Internet",
      "Claude",
    ]);
  });

  it("is a no-op when nothing is paid, and doesn't mutate the input", () => {
    const input = [internet, water];
    expect(partitionPaidLast(input, new Set()).map((e) => e.category)).toEqual(["Internet", "Water"]);
    expect(input.map((e) => e.category)).toEqual(["Internet", "Water"]);
  });
});
