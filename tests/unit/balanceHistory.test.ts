import { describe, it, expect } from "vitest";
import { monthlyBalanceSeries } from "@/lib/finance/balanceHistory";

describe("monthlyBalanceSeries", () => {
  it("returns [] with no balance-moving transactions", () => {
    expect(monthlyBalanceSeries(1000, [])).toEqual([]);
    expect(monthlyBalanceSeries(1000, [{ kind: "contribution", amount: 50, occurredOn: "2026-01-10" }])).toEqual([]);
  });

  it("reconstructs month-end balances ending at the current balance", () => {
    // current 800; two $100 payments → start was 1000, then 900, then 800.
    expect(
      monthlyBalanceSeries(800, [
        { kind: "payment", amount: 100, occurredOn: "2026-01-15" },
        { kind: "payment", amount: 100, occurredOn: "2026-02-15" },
      ]),
    ).toEqual([1000, 900, 800]);
  });

  it("a charge raises that month's balance", () => {
    // start 1000 → Jan payment 100 → 900 → Feb charge 300 → 1200 (the current balance).
    expect(
      monthlyBalanceSeries(1200, [
        { kind: "payment", amount: 100, occurredOn: "2026-01-15" },
        { kind: "charge", amount: 300, occurredOn: "2026-02-15" },
      ]),
    ).toEqual([1000, 900, 1200]);
  });

  it("collapses multiple txns in a month to that month's end balance", () => {
    expect(
      monthlyBalanceSeries(700, [
        { kind: "payment", amount: 200, occurredOn: "2026-01-05" },
        { kind: "payment", amount: 100, occurredOn: "2026-01-20" },
      ]),
    ).toEqual([1000, 700]);
  });
});
