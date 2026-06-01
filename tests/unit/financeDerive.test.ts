import { describe, it, expect } from "vitest";
import { utilization, payoffProgress, formatUsd, formatPercent } from "@/lib/finance/derive";

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
