import { describe, it, expect } from "vitest";
import { applyTransactionToBalance } from "@/lib/finance/balance";

describe("applyTransactionToBalance", () => {
  it("a charge raises the balance", () => {
    expect(applyTransactionToBalance(100, "charge", 50)).toBe(150);
  });

  it("a payment lowers the balance", () => {
    expect(applyTransactionToBalance(100, "payment", 30)).toBe(70);
  });

  it("a payment can't push the balance below zero", () => {
    expect(applyTransactionToBalance(100, "payment", 150)).toBe(0);
    expect(applyTransactionToBalance(0, "payment", 25)).toBe(0);
  });

  it("a contribution doesn't touch a debt balance", () => {
    expect(applyTransactionToBalance(100, "contribution", 50)).toBe(100);
  });

  it("stays cent-accurate across float math", () => {
    expect(applyTransactionToBalance(100.1, "charge", 0.2)).toBe(100.3);
    expect(applyTransactionToBalance(0.3, "payment", 0.1)).toBe(0.2);
  });
});
