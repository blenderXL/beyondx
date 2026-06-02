import { describe, it, expect } from "vitest";
import { debtDistribution, aprBuckets, totalUtilization, type InsightDebt } from "@/lib/finance/insights";

const dbt = (over: Partial<InsightDebt>): InsightDebt => ({
  type: "credit_card",
  balance: 0,
  apr: 0,
  credit_limit: null,
  ...over,
});

describe("debtDistribution", () => {
  it("groups balances by type, descending, with share-of-total", () => {
    const debts = [
      dbt({ type: "credit_card", balance: 1000 }),
      dbt({ type: "credit_card", balance: 500 }),
      dbt({ type: "mortgage", balance: 8500 }),
    ];
    const dist = debtDistribution(debts);
    expect(dist[0]).toMatchObject({ type: "mortgage", total: 8500 });
    expect(dist[1]).toMatchObject({ type: "credit_card", total: 1500 });
    expect(dist[0]!.pct).toBeCloseTo(0.85, 2);
    expect(dist[1]!.pct).toBeCloseTo(0.15, 2);
  });

  it("ignores zero-balance types and handles an empty list", () => {
    expect(debtDistribution([])).toEqual([]);
    expect(debtDistribution([dbt({ type: "auto", balance: 0 })])).toEqual([]);
  });
});

describe("aprBuckets", () => {
  it("buckets balances by APR range", () => {
    const debts = [
      dbt({ balance: 1000, apr: 24 }), // very high
      dbt({ balance: 2000, apr: 12 }), // mid
      dbt({ balance: 5000, apr: 2.5 }), // very low
    ];
    const buckets = Object.fromEntries(aprBuckets(debts).map((b) => [b.label, b.total]));
    expect(buckets["Very high (20%+)"]).toBe(1000);
    expect(buckets["Mid (7–15%)"]).toBe(2000);
    expect(buckets["Very low (<3%)"]).toBe(5000);
  });
});

describe("totalUtilization", () => {
  it("sums credit-card balances over limits (null when no limits)", () => {
    const debts = [
      dbt({ type: "credit_card", balance: 1500, credit_limit: 5000 }),
      dbt({ type: "mortgage", balance: 100000, credit_limit: null }), // excluded
    ];
    expect(totalUtilization(debts)).toBeCloseTo(0.3, 4);
    expect(totalUtilization([dbt({ type: "credit_card", balance: 100, credit_limit: null })])).toBeNull();
  });
});
