import { describe, it, expect } from "vitest";
import { splitPayment } from "@/lib/finance/payment";

describe("splitPayment", () => {
  it("splits a mortgage payment into interest, escrow, PMI, and principal", () => {
    // $472,680 @ 6.625% → monthly interest 2609.59; pay 4228.13 with 600 escrow.
    // principal = 4228.13 − 600 − 0 − 2609.59 = 1018.54.
    const s = splitPayment({ balance: 472680, apr: 6.625, total: 4228.13, escrow: 600, pmi: 0 });
    expect(s.interest).toBe(2609.59);
    expect(s.escrow).toBe(600);
    expect(s.pmi).toBe(0);
    expect(s.principal).toBe(1018.54);
  });

  it("splits a credit-card payment (no escrow/PMI) into interest + principal", () => {
    // $5,000 @ 24% → 100 interest; pay 200 → 100 principal.
    const s = splitPayment({ balance: 5000, apr: 24, total: 200 });
    expect(s.interest).toBe(100);
    expect(s.escrow).toBe(0);
    expect(s.pmi).toBe(0);
    expect(s.principal).toBe(100);
  });

  it("treats a 0% APR payment as all principal (less escrow/PMI)", () => {
    const s = splitPayment({ balance: 1000, apr: 0, total: 200 });
    expect(s.interest).toBe(0);
    expect(s.principal).toBe(200);
  });

  it("floors principal at 0 when the payment can't cover interest + escrow + PMI", () => {
    // $1,000 @ 24% → 20 interest; pay only 10 → principal can't go negative.
    const s = splitPayment({ balance: 1000, apr: 24, total: 10 });
    expect(s.interest).toBe(20);
    expect(s.principal).toBe(0);
  });

  it("caps principal at the balance (can't pay off more than is owed)", () => {
    const s = splitPayment({ balance: 100, apr: 0, total: 500 });
    expect(s.principal).toBe(100);
  });

  it("defaults missing escrow/PMI to 0 and ignores negative inputs", () => {
    const s = splitPayment({ balance: 1000, apr: 0, total: 300, escrow: -50 });
    expect(s.escrow).toBe(0);
    expect(s.pmi).toBe(0);
    expect(s.principal).toBe(300);
  });

  it("no interest on a zero/negative balance", () => {
    expect(splitPayment({ balance: 0, apr: 24, total: 100 }).interest).toBe(0);
    expect(splitPayment({ balance: 0, apr: 24, total: 100 }).principal).toBe(0);
  });

  it("rounds interest and principal to cents", () => {
    // $1,234.56 @ 19.99% → 1234.56*0.1999/12 = 20.5657… → 20.57; principal 100 − 20.57 = 79.43.
    const s = splitPayment({ balance: 1234.56, apr: 19.99, total: 100 });
    expect(s.interest).toBe(20.57);
    expect(s.principal).toBe(79.43);
  });
});
