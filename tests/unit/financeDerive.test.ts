import { describe, it, expect } from "vitest";
import {
  utilization,
  payoffProgress,
  suggestedMinimum,
  formatUsd,
  formatPercent,
  formatDueDate,
  expenseDisplayAmount,
} from "@/lib/finance/derive";

describe("utilization", () => {
  it("is balance over limit", () => {
    expect(utilization(50, 100)).toBe(0.5);
    expect(utilization(110, 100)).toBeCloseTo(1.1);
  });
  it("is null without a usable limit", () => {
    expect(utilization(50, null)).toBeNull();
    expect(utilization(50, 0)).toBeNull();
  });
});

describe("payoffProgress", () => {
  it("is the fraction paid off, clamped to 0–1", () => {
    expect(payoffProgress(50, 100)).toBe(0.5);
    expect(payoffProgress(0, 100)).toBe(1);
    expect(payoffProgress(150, 100)).toBe(0); // balance above original → 0, never negative
  });
  it("is null without an original balance", () => {
    expect(payoffProgress(50, null)).toBeNull();
    expect(payoffProgress(50, 0)).toBeNull();
  });
});

describe("suggestedMinimum", () => {
  it("is 1% of balance + this month's interest", () => {
    // $5,000 @ 24% → 1%·5000 ($50) + interest (5000·0.24/12 = $100) = $150.
    expect(suggestedMinimum(5000, 24)).toBe(150);
    // $2,000 @ 0% → 1%·2000 ($20) floored to the $25 minimum.
    expect(suggestedMinimum(2000, 0)).toBe(25);
  });
  it("never drops below $25", () => {
    expect(suggestedMinimum(100, 20)).toBe(25);
  });
  it("is 0 for a zero/negative balance", () => {
    expect(suggestedMinimum(0, 24)).toBe(0);
    expect(suggestedMinimum(-10, 24)).toBe(0);
  });
  it("rounds to cents", () => {
    // $1,234.56 @ 19.99% → 12.3456 + 20.563... = 32.908... → 32.91
    expect(suggestedMinimum(1234.56, 19.99)).toBe(32.91);
  });
});

describe("expenseDisplayAmount", () => {
  it("is the entered amount for a regular expense", () => {
    expect(expenseDisplayAmount({ expense_group: "utility", pct_of_income: null, amount: 115 }, 6000)).toBe(115);
  });
  it("is the entered amount for a fixed offering", () => {
    expect(expenseDisplayAmount({ expense_group: "offering", pct_of_income: null, amount: 200 }, 6000)).toBe(200);
  });
  it("resolves a percent offering to its dollar value of income (the offering-% bug)", () => {
    // 10% of $6,000 income → $600, even though the stored amount is 0.
    expect(expenseDisplayAmount({ expense_group: "offering", pct_of_income: 10, amount: 0 }, 6000)).toBe(600);
  });
  it("rounds a percent offering to cents", () => {
    expect(expenseDisplayAmount({ expense_group: "offering", pct_of_income: 7.5, amount: 0 }, 1234.56)).toBe(92.59);
  });
});

describe("formatting", () => {
  it("formats USD", () => {
    expect(formatUsd(1000)).toBe("$1,000.00");
    expect(formatUsd(0)).toBe("$0.00");
  });
  it("formats APR as a percentage", () => {
    expect(formatPercent(24.24)).toBe("24.24%");
    expect(formatPercent(0)).toBe("0%");
  });
});

describe("formatDueDate", () => {
  it("formats the real next due date (UTC, no off-by-one)", () => {
    expect(formatDueDate("2026-07-01", null)).toBe("Jul 1");
    expect(formatDueDate("2026-12-31", null)).toBe("Dec 31");
  });
  it("falls back to the legacy day-of-month", () => {
    expect(formatDueDate(null, 5)).toBe("day 5");
  });
  it("is an em dash when neither is set", () => {
    expect(formatDueDate(null, null)).toBe("—");
  });
});
