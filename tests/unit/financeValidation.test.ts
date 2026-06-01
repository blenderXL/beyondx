import { describe, it, expect } from "vitest";
import {
  parseMoney,
  round2,
  round4,
  MONEY_MAX,
  APR_MAX,
  validateDebtInput,
  validateTransactionInput,
} from "@/lib/finance/validation";

describe("parseMoney", () => {
  it("parses formatted money", () => {
    expect(parseMoney("$1,234.50")).toBe(1234.5);
    expect(parseMoney(" 1200 ")).toBe(1200);
    expect(parseMoney("0")).toBe(0);
  });
  it("returns null for blank or non-numeric", () => {
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("   ")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney(null)).toBeNull();
    expect(parseMoney(undefined)).toBeNull();
  });
});

describe("rounding", () => {
  it("round2 rounds to cents", () => {
    expect(round2(10.994)).toBe(10.99);
    expect(round2(10.996)).toBe(11);
    expect(round2(1234.567)).toBe(1234.57);
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });
  it("round4 rounds to APR precision", () => {
    expect(round4(24.24)).toBe(24.24);
    expect(round4(1.23456)).toBe(1.2346);
    expect(round4(0)).toBe(0);
  });
});

describe("validateDebtInput", () => {
  const base = { name: "Chase", type: "credit_card", balance: "1000" };

  it("accepts a minimal valid debt and defaults APR/min to 0", () => {
    const r = validateDebtInput(base);
    expect(r.ok).toBe(true);
    expect(r.values).toMatchObject({
      name: "Chase",
      type: "credit_card",
      balance: 1000,
      apr: 0,
      min_payment: 0,
      due_day: null,
      deferred_interest: false,
    });
  });

  it("normalizes every optional field when provided", () => {
    const r = validateDebtInput({
      ...base,
      issuer: "Chase",
      apr: "24.24",
      min_payment: "$50.00",
      credit_limit: "11,000",
      due_day: "15",
      promo_apr: "0",
      promo_until: "2026-12-31",
      deferred_interest: "on",
      notes: "balance transfer",
    });
    expect(r.ok).toBe(true);
    expect(r.values).toMatchObject({
      issuer: "Chase",
      apr: 24.24,
      min_payment: 50,
      credit_limit: 11000,
      due_day: 15,
      promo_apr: 0,
      promo_until: "2026-12-31",
      deferred_interest: true,
      notes: "balance transfer",
    });
  });

  it("requires a name", () => {
    expect(validateDebtInput({ ...base, name: "" }).error).toMatch(/name/i);
  });

  it("rejects an unknown type", () => {
    expect(validateDebtInput({ ...base, type: "crypto" }).error).toMatch(/valid debt type/i);
  });

  it("requires a parseable balance", () => {
    expect(validateDebtInput({ ...base, balance: "abc" }).error).toMatch(/current balance/i);
    expect(validateDebtInput({ ...base, balance: "" }).error).toMatch(/current balance/i);
  });

  it("rejects a negative balance", () => {
    expect(validateDebtInput({ ...base, balance: "-5" }).error).toMatch(/negative/i);
  });

  it("rejects amounts beyond numeric(14,2)", () => {
    expect(validateDebtInput({ ...base, balance: String(MONEY_MAX + 1) }).error).toMatch(
      /too large/i,
    );
  });

  it("bounds APR to numeric(6,4)", () => {
    expect(validateDebtInput({ ...base, apr: String(APR_MAX + 1) }).error).toMatch(
      /APR can't exceed/i,
    );
    expect(validateDebtInput({ ...base, apr: "-1" }).error).toMatch(/negative/i);
  });

  it("bounds due day to 1–31", () => {
    expect(validateDebtInput({ ...base, due_day: "0" }).error).toMatch(/1 to 31/i);
    expect(validateDebtInput({ ...base, due_day: "40" }).error).toMatch(/1 to 31/i);
    expect(validateDebtInput({ ...base, due_day: "12.5" }).error).toMatch(/1 to 31/i);
  });

  it("rejects an invalid promo date", () => {
    expect(validateDebtInput({ ...base, promo_until: "12/31/2026" }).error).toMatch(
      /promo end date/i,
    );
  });
});

describe("validateTransactionInput", () => {
  it("accepts a payment", () => {
    const r = validateTransactionInput({ kind: "payment", amount: "50" });
    expect(r.ok).toBe(true);
    expect(r.values).toMatchObject({ kind: "payment", amount: 50 });
  });

  it("requires a known kind", () => {
    expect(validateTransactionInput({ kind: "refund", amount: "5" }).error).toMatch(
      /transaction type/i,
    );
  });

  it("requires a positive amount", () => {
    expect(validateTransactionInput({ kind: "charge", amount: "0" }).error).toMatch(
      /greater than zero/i,
    );
    expect(validateTransactionInput({ kind: "charge", amount: "-5" }).error).toMatch(
      /greater than zero/i,
    );
    expect(validateTransactionInput({ kind: "charge", amount: "abc" }).error).toMatch(
      /enter an amount/i,
    );
  });

  it("rejects an invalid date", () => {
    expect(
      validateTransactionInput({ kind: "payment", amount: "5", occurred_on: "nope" }).error,
    ).toMatch(/date is invalid/i);
  });
});
