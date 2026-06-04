import { describe, it, expect } from "vitest";
import { buildAmortizationCsv } from "@/lib/finance/amortizationCsv";
import type { PayoffMonth } from "@/lib/finance/payoff";

const month = (over: Partial<PayoffMonth> & { month: number }): PayoffMonth => ({
  totalBalance: 0,
  totalInterest: 0,
  totalPaid: 0,
  byDebt: {},
  ...over,
});

describe("buildAmortizationCsv", () => {
  const debts = [
    { id: "a", name: "Citi" },
    { id: "b", name: "Tesla" },
  ];
  const schedule: PayoffMonth[] = [
    month({
      month: 1,
      totalInterest: 12.5,
      totalBalance: 800,
      totalPaid: 200,
      byDebt: { a: { payment: 150, balance: 600, interest: 10 }, b: { payment: 50, balance: 200, interest: 2.5 } },
    }),
  ];

  it("emits a header with a column per debt plus totals", () => {
    const csv = buildAmortizationCsv(debts, schedule, ["Jul 2026"]);
    expect(csv.split("\n")[0]).toBe("Month,Citi,Tesla,Interest,Balance,Total paid");
  });

  it("emits a data row with per-debt payments and month totals (2dp)", () => {
    const csv = buildAmortizationCsv(debts, schedule, ["Jul 2026"]);
    expect(csv.split("\n")[1]).toBe("Jul 2026,150.00,50.00,12.50,800.00,200.00");
  });

  it("escapes a debt name containing a comma", () => {
    const csv = buildAmortizationCsv([{ id: "a", name: "Loan, personal" }], schedule, ["Jul 2026"]);
    expect(csv.split("\n")[0]).toBe('Month,"Loan, personal",Interest,Balance,Total paid');
  });

  it("falls back to the month index when no label is supplied", () => {
    const csv = buildAmortizationCsv(debts, schedule, []);
    expect(csv.split("\n")[1]!.startsWith("1,")).toBe(true);
  });
});
