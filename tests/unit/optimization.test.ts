import { describe, it, expect } from "vitest";
import { bestExtraPaymentInsight } from "@/lib/finance/optimization";
import type { PayoffDebtInput } from "@/lib/finance/payoff";

const cc: PayoffDebtInput = { id: "cc", name: "Apple Card", balance: 4000, apr: 24, min_payment: 80 };
const auto: PayoffDebtInput = { id: "auto", name: "Auto", balance: 8000, apr: 5, min_payment: 200 };

describe("bestExtraPaymentInsight", () => {
  it("returns null with no debts", () => {
    expect(bestExtraPaymentInsight([], "avalanche")).toBeNull();
  });

  it("targets the highest-APR debt under avalanche and reports a positive saving", () => {
    const insight = bestExtraPaymentInsight([cc, auto], "avalanche", 100);
    expect(insight).not.toBeNull();
    expect(insight!.debtName).toBe("Apple Card"); // 24% APR beats 5%
    expect(insight!.extra).toBe(100);
    expect(insight!.interestSaved).toBeGreaterThan(0);
  });

  it("targets the smallest balance under snowball", () => {
    const insight = bestExtraPaymentInsight([cc, auto], "snowball", 100);
    expect(insight!.debtName).toBe("Apple Card"); // 4000 < 8000
  });

  it("returns null for an interest-free debt (no interest to save)", () => {
    const free: PayoffDebtInput = { id: "f", name: "Free", balance: 1000, apr: 0, min_payment: 50 };
    expect(bestExtraPaymentInsight([free], "avalanche")).toBeNull();
  });
});
