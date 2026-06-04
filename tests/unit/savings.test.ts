import { describe, it, expect } from "vitest";
import { cumulativeByMonth, recentMonths, type MonthlyContribution } from "@/lib/finance/savings";

describe("cumulativeByMonth", () => {
  const window = ["2026-03", "2026-04", "2026-05", "2026-06"];

  it("accumulates contributions into a running total per month", () => {
    const c: MonthlyContribution[] = [
      { month: "2026-03", amount: 100 },
      { month: "2026-04", amount: 50 },
      { month: "2026-06", amount: 200 },
    ];
    expect(cumulativeByMonth(c, window)).toEqual([100, 150, 150, 350]);
  });

  it("folds pre-window contributions into the opening total", () => {
    const c: MonthlyContribution[] = [
      { month: "2025-12", amount: 500 }, // before the window
      { month: "2026-04", amount: 100 },
    ];
    expect(cumulativeByMonth(c, window)).toEqual([500, 600, 600, 600]);
  });

  it("is all-zero with no contributions", () => {
    expect(cumulativeByMonth([], window)).toEqual([0, 0, 0, 0]);
  });

  it("rounds the running total to cents", () => {
    const c: MonthlyContribution[] = [
      { month: "2026-03", amount: 10.1 },
      { month: "2026-03", amount: 20.2 },
    ];
    expect(cumulativeByMonth(c, ["2026-03"])).toEqual([30.3]);
  });
});

describe("recentMonths", () => {
  it("returns the last N months ascending, ending at the anchor", () => {
    // anchor June 2026 (month index 5), 4 months → Mar..Jun.
    expect(recentMonths(2026, 5, 4)).toEqual(["2026-03", "2026-04", "2026-05", "2026-06"]);
  });

  it("rolls over a year boundary", () => {
    // anchor Feb 2026 (index 1), 4 months → Nov 2025..Feb 2026.
    expect(recentMonths(2026, 1, 4)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
});
