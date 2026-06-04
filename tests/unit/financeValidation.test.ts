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
  it("tolerates a trailing percent sign (interest-rate inputs)", () => {
    expect(parseMoney("20.74%")).toBe(20.74);
    expect(parseMoney("50 %")).toBe(50);
    expect(parseMoney("0%")).toBe(0);
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
  // credit_card is a non-exempt type, so a next_due_date is required on create.
  const base = { name: "Chase", type: "credit_card", balance: "1000", next_due_date: "2026-07-01" };

  it("accepts a minimal valid debt and defaults APR/min to 0", () => {
    const r = validateDebtInput(base);
    expect(r.ok).toBe(true);
    expect(r.values).toMatchObject({
      name: "Chase",
      type: "credit_card",
      balance: 1000,
      apr: 0,
      min_payment: 0,
      next_due_date: "2026-07-01",
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
      next_due_date: "2026-08-15",
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
      next_due_date: "2026-08-15",
      promo_apr: 0,
      promo_until: "2026-12-31",
      deferred_interest: true,
      notes: "balance transfer",
    });
  });

  it("accepts the expanded debt types", () => {
    for (const type of ["loan_401k", "home_equity", "personal_loan", "savings_club"]) {
      const fields = type === "savings_club" ? { ...base, type } : { ...base, type };
      expect(validateDebtInput(fields).ok).toBe(true);
    }
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

  it("accepts an optional editable original_balance (null when blank)", () => {
    expect(validateDebtInput(base).values?.original_balance).toBeNull();
    expect(validateDebtInput({ ...base, original_balance: "$1,500.00" }).values?.original_balance).toBe(1500);
    expect(validateDebtInput({ ...base, original_balance: "-5" }).error).toMatch(/starting balance/i);
  });

  it("accepts an optional ISO start_date and rejects a malformed one", () => {
    expect(validateDebtInput(base).values?.start_date).toBeNull();
    expect(validateDebtInput({ ...base, start_date: "2024-01-15" }).values?.start_date).toBe("2024-01-15");
    expect(validateDebtInput({ ...base, start_date: "Jan 2024" }).error).toMatch(/start date/i);
  });

  it("rejects a negative balance", () => {
    expect(validateDebtInput({ ...base, balance: "-5" }).error).toMatch(/negative/i);
  });

  it("rejects amounts beyond numeric(14,2)", () => {
    expect(validateDebtInput({ ...base, balance: String(MONEY_MAX + 1) }).error).toMatch(
      /too large/i,
    );
  });

  it("accepts an APR typed with a percent sign", () => {
    const r = validateDebtInput({ ...base, apr: "24.99%" });
    expect(r.ok).toBe(true);
    expect(r.values).toMatchObject({ apr: 24.99 });
  });

  it("bounds APR to numeric(6,4)", () => {
    expect(validateDebtInput({ ...base, apr: String(APR_MAX + 1) }).error).toMatch(
      /APR can't exceed/i,
    );
    expect(validateDebtInput({ ...base, apr: "-1" }).error).toMatch(/negative/i);
  });

  it("requires next_due_date on create for a non-exempt type", () => {
    const { next_due_date, ...noDate } = base;
    void next_due_date;
    expect(validateDebtInput(noDate).error).toMatch(/due date/i);
  });

  it("does NOT require next_due_date for exempt types (medical, savings club)", () => {
    expect(validateDebtInput({ name: "ER bill", type: "medical", balance: "500" }).ok).toBe(true);
    expect(validateDebtInput({ name: "Club", type: "savings_club", balance: "50" }).ok).toBe(true);
  });

  it("is lenient about a missing next_due_date on update (editing legacy rows)", () => {
    expect(validateDebtInput({ name: "Chase", type: "credit_card", balance: "1000" }, "update").ok).toBe(true);
  });

  it("rejects an invalid next_due_date", () => {
    expect(validateDebtInput({ ...base, next_due_date: "07/01/2026" }).error).toMatch(/due date/i);
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
