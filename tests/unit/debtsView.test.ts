import { describe, it, expect } from "vitest";
import { filterAndSortDebts, type DebtViewOptions } from "@/lib/finance/debtsView";
import type { Debt, DebtType } from "@/lib/finance/types";

const debt = (over: Partial<Debt> & { name: string }): Debt => ({
  id: over.name,
  profile_id: "p",
  type: "credit_card",
  balance: 0,
  apr: 0,
  min_payment: 0,
  due_day: null,
  next_due_date: null,
  archived_at: null,
  created_at: "",
  updated_at: "",
  credit_limit: null,
  original_balance: null,
  start_date: null,
  escrow: null,
  pmi: null,
  issuer: null,
  promo_apr: null,
  promo_until: null,
  deferred_interest: false,
  payoff_order: null,
  notes: null,
  ...over,
});

const opts = (over: Partial<DebtViewOptions> = {}): DebtViewOptions => ({
  query: "",
  type: "all",
  sort: "balance_desc",
  ...over,
});

const debts: Debt[] = [
  debt({ name: "Citi Cashback", type: "credit_card", balance: 3000, apr: 20.74, next_due_date: "2026-07-15", issuer: "Citi" }),
  debt({ name: "Capital One", type: "credit_card", balance: 67, apr: 28.4, next_due_date: "2026-07-02" }),
  debt({ name: "Rental Home", type: "mortgage", balance: 238506, apr: 2.875, due_day: 1 }),
];

describe("filterAndSortDebts — filtering", () => {
  it("matches the query against name and issuer (case-insensitive)", () => {
    expect(filterAndSortDebts(debts, opts({ query: "citi" })).map((d) => d.name)).toEqual(["Citi Cashback"]);
    // 'Citi' also appears as the issuer of Citi Cashback only.
    expect(filterAndSortDebts(debts, opts({ query: "RENTAL" })).map((d) => d.name)).toEqual(["Rental Home"]);
  });

  it("filters by debt type", () => {
    expect(filterAndSortDebts(debts, opts({ type: "mortgage" as DebtType })).map((d) => d.name)).toEqual([
      "Rental Home",
    ]);
    expect(filterAndSortDebts(debts, opts({ type: "credit_card" as DebtType })).length).toBe(2);
  });

  it("returns everything when query is blank and type is all", () => {
    expect(filterAndSortDebts(debts, opts()).length).toBe(3);
  });

  it("does not mutate the input array", () => {
    const copy = [...debts];
    filterAndSortDebts(debts, opts({ sort: "name_asc" }));
    expect(debts).toEqual(copy);
  });
});

describe("filterAndSortDebts — sorting", () => {
  it("balance high → low", () => {
    expect(filterAndSortDebts(debts, opts({ sort: "balance_desc" })).map((d) => d.name)).toEqual([
      "Rental Home",
      "Citi Cashback",
      "Capital One",
    ]);
  });
  it("interest high → low", () => {
    expect(filterAndSortDebts(debts, opts({ sort: "apr_desc" })).map((d) => d.name)).toEqual([
      "Capital One",
      "Citi Cashback",
      "Rental Home",
    ]);
  });
  it("due date soonest (real dates before day-only)", () => {
    expect(filterAndSortDebts(debts, opts({ sort: "due_asc" })).map((d) => d.name)).toEqual([
      "Capital One", // 2026-07-02
      "Citi Cashback", // 2026-07-15
      "Rental Home", // day 1 only → after dated debts
    ]);
  });
  it("name A → Z", () => {
    expect(filterAndSortDebts(debts, opts({ sort: "name_asc" })).map((d) => d.name)).toEqual([
      "Capital One",
      "Citi Cashback",
      "Rental Home",
    ]);
  });
});
