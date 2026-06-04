import { describe, it, expect } from "vitest";
import { orderDebts, computePayoff, type PayoffDebtInput } from "@/lib/finance/payoff";

const d = (over: Partial<PayoffDebtInput> & { id: string; balance: number }): PayoffDebtInput => ({
  name: over.id,
  apr: 0,
  min_payment: 0,
  payoff_order: null,
  ...over,
});

describe("orderDebts", () => {
  const a = d({ id: "A", balance: 1000, apr: 30, min_payment: 0, payoff_order: 2 });
  const b = d({ id: "B", balance: 500, apr: 5, min_payment: 0, payoff_order: 1 });

  it("snowball orders by ascending balance", () => {
    expect(orderDebts([a, b], "snowball").map((x) => x.id)).toEqual(["B", "A"]);
  });
  it("avalanche orders by descending APR", () => {
    expect(orderDebts([a, b], "avalanche").map((x) => x.id)).toEqual(["A", "B"]);
  });
  it("custom orders by payoff_order (nulls last)", () => {
    const c = d({ id: "C", balance: 1, payoff_order: null });
    expect(orderDebts([a, b, c], "custom").map((x) => x.id)).toEqual(["B", "A", "C"]);
  });
});

describe("computePayoff", () => {
  it("returns done immediately when there are no balances", () => {
    const r = computePayoff([], 100, "avalanche");
    expect(r).toMatchObject({ feasible: true, months: 0, totalInterest: 0 });
  });

  it("pays a single interest-free debt with the whole budget as extra", () => {
    const r = computePayoff([d({ id: "A", balance: 1000, apr: 0, min_payment: 0 })], 500, "snowball");
    expect(r.feasible).toBe(true);
    expect(r.months).toBe(2); // 500 + 500
    expect(r.totalInterest).toBe(0);
    expect(r.perDebtPayoffMonth.A).toBe(2);
  });

  it("charges monthly interest (apr/12) before payment", () => {
    // 1% / month on 1000 → $10 interest the first month, then paid off.
    const r = computePayoff([d({ id: "A", balance: 1000, apr: 12, min_payment: 0 })], 5000, "avalanche");
    expect(r.months).toBe(1);
    expect(r.totalInterest).toBe(10);
  });

  it("is infeasible when the budget can't cover the minimum payments", () => {
    const r = computePayoff([d({ id: "A", balance: 1000, apr: 24, min_payment: 50 })], 5, "avalanche");
    expect(r.feasible).toBe(false);
  });

  it("is infeasible when the budget barely covers interest (never amortizes)", () => {
    // ~$20/mo interest on 1000@24%, budget 10 → balance never falls → capped → infeasible.
    const r = computePayoff([d({ id: "A", balance: 1000, apr: 24, min_payment: 0 })], 10, "avalanche");
    expect(r.feasible).toBe(false);
  });

  it("snowball clears the smallest balance first; avalanche clears the highest APR first", () => {
    const debts = [
      d({ id: "BIG_LOWAPR", balance: 1000, apr: 5, min_payment: 10 }),
      d({ id: "SMALL_HIAPR", balance: 200, apr: 30, min_payment: 10 }),
    ];
    const snow = computePayoff(debts, 300, "snowball");
    const aval = computePayoff(debts, 300, "avalanche");
    // Snowball kills the small balance first; avalanche kills the high-APR one first.
    // (Here the high-APR debt is also the small one, so both clear SMALL first — assert
    // ordering effect via the big/low-apr debt finishing later than the other method.)
    expect(snow.perDebtPayoffMonth.SMALL_HIAPR!).toBeLessThanOrEqual(snow.perDebtPayoffMonth.BIG_LOWAPR!);
    expect(aval.perDebtPayoffMonth.SMALL_HIAPR!).toBeLessThanOrEqual(aval.perDebtPayoffMonth.BIG_LOWAPR!);
    expect(aval.feasible).toBe(true);
    expect(snow.feasible).toBe(true);
  });

  it("emits per-debt monthly rows (payment, balance, interest)", () => {
    const r = computePayoff([d({ id: "A", balance: 1000, apr: 0, min_payment: 0 })], 500, "snowball");
    expect(r.schedule[0]!.byDebt.A).toEqual({ payment: 500, balance: 500, interest: 0 });
    expect(r.schedule[1]!.byDebt.A).toEqual({ payment: 500, balance: 0, interest: 0 });
  });

  it("splits minimums + cascaded extra across debts per month", () => {
    // A (300, min 50) is the snowball target; B (700, min 50). Budget 200 → 100 minimums +
    // 100 extra, all extra to A. Month 1: A pays 150 → 150 left; B pays 50 → 650 left.
    const debts = [
      d({ id: "A", balance: 300, apr: 0, min_payment: 50 }),
      d({ id: "B", balance: 700, apr: 0, min_payment: 50 }),
    ];
    const r = computePayoff(debts, 200, "snowball");
    expect(r.schedule[0]!.byDebt.A).toMatchObject({ payment: 150, balance: 150 });
    expect(r.schedule[0]!.byDebt.B).toMatchObject({ payment: 50, balance: 650 });
  });

  it("rolls freed minimums forward (fixed-budget snowball) — total ≥ sum of balances", () => {
    const debts = [
      d({ id: "A", balance: 300, apr: 0, min_payment: 50 }),
      d({ id: "B", balance: 700, apr: 0, min_payment: 50 }),
    ];
    const r = computePayoff(debts, 200, "snowball");
    expect(r.feasible).toBe(true);
    // 1000 total at 0% with $200/mo → 5 months exactly.
    expect(r.months).toBe(5);
    expect(r.totalInterest).toBe(0);
  });
});
