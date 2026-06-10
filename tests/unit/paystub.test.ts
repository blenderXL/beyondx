import { describe, it, expect } from "vitest";
import { estimatePaystub, annualGross, dividePaystub, type PaystubInputs } from "@/lib/paystub/tax";

const base: PaystubInputs = {
  payType: "salary",
  rate: 60000,
  hoursPerWeek: 40,
  cadence: "biweekly",
  state: "TX",
  filingStatus: "single",
  pretax401kPct: 0,
  otherPretaxMonthly: 0,
};

describe("annualGross", () => {
  it("salary uses the rate directly", () => {
    expect(annualGross({ payType: "salary", rate: 80000, hoursPerWeek: 0 })).toBe(80000);
  });
  it("hourly = rate × hours × 52", () => {
    expect(annualGross({ payType: "hourly", rate: 30, hoursPerWeek: 40 })).toBe(62400);
  });
});

describe("estimatePaystub", () => {
  it("single, $60k, no-tax state, no 401k", () => {
    const b = estimatePaystub(base);
    // fed taxable = 60000 − 15000 = 45000 → 10%×11925 + 12%×33075 = 1192.50 + 3969 = 5161.50
    expect(b.federal).toBe(5161.5);
    expect(b.socialSecurity).toBe(3720); // 60000 × 6.2%
    expect(b.medicare).toBe(870); // 60000 × 1.45%
    expect(b.state).toBe(0); // TX
    expect(b.net).toBe(50248.5); // 60000 − 5161.50 − 3720 − 870
    expect(b.periodsPerYear).toBe(26);
  });

  it("applies a flat state rate to gross-less-pretax", () => {
    expect(estimatePaystub({ ...base, state: "CA" }).state).toBe(3600); // 60000 × 6%
  });

  it("401(k) lowers federal + take-home but not FICA", () => {
    const b = estimatePaystub({ ...base, pretax401kPct: 10 });
    expect(b.pretax401k).toBe(6000);
    // fed taxable = 60000 − 6000 − 15000 = 39000 → 1192.50 + 12%×27075 = 4441.50
    expect(b.federal).toBe(4441.5);
    expect(b.socialSecurity).toBe(3720); // FICA unchanged
    expect(b.net).toBe(44968.5); // 60000 − 6000 − 4441.50 − 3720 − 870
  });

  it("dividePaystub splits the annual figures into a paycheck", () => {
    const b = estimatePaystub(base);
    const perCheck = dividePaystub(b, b.periodsPerYear);
    expect(perCheck.gross).toBe(2307.69); // 60000 / 26
    expect(perCheck.net).toBeCloseTo(50248.5 / 26, 2);
  });
});
