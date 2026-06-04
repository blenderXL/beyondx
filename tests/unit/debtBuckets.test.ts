import { describe, it, expect } from "vitest";
import { typeBucket } from "@/lib/finance/types";
import { bucketDistribution } from "@/lib/finance/insights";
import { cardMetricsFor } from "@/lib/finance/cardMetrics";
import { filterAndSortDebts } from "@/lib/finance/debtsView";
import type { Debt } from "@/lib/finance/types";

const debt = (over: Partial<Debt> & { name: string; type: Debt["type"] }): Debt => ({
  id: over.name,
  profile_id: "p",
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
  issuer: null,
  promo_apr: null,
  promo_until: null,
  deferred_interest: false,
  payoff_order: null,
  notes: null,
  ...over,
});

describe("typeBucket", () => {
  it("rolls types into higher-level buckets", () => {
    expect(typeBucket("credit_card")).toBe("credit_cards");
    expect(typeBucket("mortgage")).toBe("mortgage");
    expect(typeBucket("home_equity")).toBe("mortgage");
    expect(typeBucket("auto")).toBe("auto");
    expect(typeBucket("student")).toBe("loans");
    expect(typeBucket("loan_401k")).toBe("loans");
    expect(typeBucket("medical")).toBe("other");
  });
});

describe("bucketDistribution", () => {
  it("sums balances by bucket, descending, pct sums to ~1", () => {
    const slices = bucketDistribution([
      { type: "credit_card", balance: 1000, apr: 20, credit_limit: null },
      { type: "credit_card", balance: 2000, apr: 25, credit_limit: null },
      { type: "mortgage", balance: 200000, apr: 3, credit_limit: null },
    ]);
    expect(slices[0]!.bucket).toBe("mortgage");
    expect(slices.find((s) => s.bucket === "credit_cards")!.total).toBe(3000);
    expect(slices.reduce((s, x) => s + x.pct, 0)).toBeCloseTo(1, 5);
    expect(slices.every((s) => typeof s.accentVar === "string")).toBe(true);
  });
  it("is empty when there are no positive balances", () => {
    expect(bucketDistribution([])).toEqual([]);
  });
});

describe("cardMetricsFor", () => {
  it("shows Util for a credit card", () => {
    const m = cardMetricsFor(debt({ name: "Citi", type: "credit_card", balance: 500, credit_limit: 1000 }));
    expect(m.map((x) => x.label)).toEqual(["APR", "Min", "Due", "Util"]);
    expect(m[3]!.value).toBe("50%");
  });
  it("shows % Paid for an amortizing debt (mortgage)", () => {
    const m = cardMetricsFor(debt({ name: "Home", type: "mortgage", balance: 75, original_balance: 100 }));
    expect(m[3]).toEqual({ label: "Paid", value: "25%" });
  });
  it("omits the 4th stat for non-amortizing types (medical → 3 stats)", () => {
    const m = cardMetricsFor(debt({ name: "ER", type: "medical", balance: 500 }));
    expect(m.map((x) => x.label)).toEqual(["APR", "Min", "Due"]);
  });
});

describe("reverse sorts", () => {
  const debts = [
    debt({ name: "A", type: "credit_card", balance: 100, apr: 10 }),
    debt({ name: "B", type: "credit_card", balance: 300, apr: 30 }),
    debt({ name: "C", type: "credit_card", balance: 200, apr: 20 }),
  ];
  const names = (sort: Parameters<typeof filterAndSortDebts>[1]["sort"]) =>
    filterAndSortDebts(debts, { query: "", type: "all", sort }).map((d) => d.name);
  it("balance low→high and high→low", () => {
    expect(names("balance_asc")).toEqual(["A", "C", "B"]);
    expect(names("balance_desc")).toEqual(["B", "C", "A"]);
  });
  it("interest low→high", () => {
    expect(names("apr_asc")).toEqual(["A", "C", "B"]);
  });
  it("name Z→A", () => {
    expect(names("name_desc")).toEqual(["C", "B", "A"]);
  });
});
