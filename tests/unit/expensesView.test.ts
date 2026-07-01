import { describe, it, expect } from "vitest";
import {
  filterAndSortExpenses,
  partitionPaidLast,
  summarizeByCard,
  EXPENSE_SORTS,
  type ExpenseViewOptions,
} from "@/lib/finance/expensesView";
import type { Card, Expense } from "@/lib/finance/types";

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

describe("summarizeByCard", () => {
  const card = (id: string, over: Partial<Card> = {}): Card => ({
    id,
    profile_id: "p",
    name: id,
    card_type: "credit",
    archived_at: null,
    created_at: "",
    updated_at: "",
    ...over,
  });
  const amex = card("amex");
  const visa = card("visa", { card_type: "debit" });

  it("rolls planned + paid + count up per card, in card order", () => {
    const es = [
      exp({ category: "Rent", amount: 1500, card_id: amex.id }),
      exp({ category: "Groceries", amount: 400, card_id: amex.id }),
      exp({ category: "Gym", amount: 50, card_id: visa.id }),
    ];
    const paid = new Set(["Rent"]); // exp() uses category as id
    const out = summarizeByCard(es, [amex, visa], 0, paid);
    expect(out).toEqual([
      { cardId: "amex", planned: 1900, paid: 1500, count: 2 },
      { cardId: "visa", planned: 50, paid: 0, count: 1 },
    ]);
  });

  it("buckets untagged and archived/unknown-card expenses into a trailing unassigned row", () => {
    const es = [
      exp({ category: "Rent", amount: 1500, card_id: amex.id }),
      exp({ category: "Water", amount: 60 }), // no card
      exp({ category: "Old", amount: 25, card_id: "ghost" }), // card not in active list
    ];
    const out = summarizeByCard(es, [amex], 0, new Set());
    expect(out).toEqual([
      { cardId: "amex", planned: 1500, paid: 0, count: 1 },
      { cardId: null, planned: 85, paid: 0, count: 2 },
    ]);
  });

  it("shows every active card even at $0 and omits an empty unassigned bucket", () => {
    const out = summarizeByCard([], [amex, visa], 0, new Set());
    expect(out).toEqual([
      { cardId: "amex", planned: 0, paid: 0, count: 0 },
      { cardId: "visa", planned: 0, paid: 0, count: 0 },
    ]);
  });

  it("resolves a percent offering against income", () => {
    const es = [exp({ category: "Tithe", amount: 0, expense_group: "offering", pct_of_income: 10, card_id: amex.id })];
    const out = summarizeByCard(es, [amex], 5000, new Set());
    expect(out[0]).toEqual({ cardId: "amex", planned: 500, paid: 0, count: 1 });
  });
});
