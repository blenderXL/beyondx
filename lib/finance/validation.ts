/**
 * Pure, dependency-free validators for the finance forms. Enforced server-side in
 * the Server Actions (untrusted input) and unit-tested in isolation. The browser
 * gets immediate feedback from native HTML constraints; these are the real gate.
 */

import { DEBT_TYPES, type DebtType, type TransactionKind } from "@/lib/finance/types";

/** numeric(14,2): 12 integer digits + 2 decimals. */
export const MONEY_MAX = 999_999_999_999.99;
/** numeric(6,4) stores APR as a percentage: 2 integer digits + 4 decimals. */
export const APR_MAX = 99.9999;

/** Round to cents — the DB column rounds to 2dp on write, so we do it explicitly up front. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Round to APR precision (4dp) to match numeric(6,4). */
export function round4(n: number): number {
  return Math.round((n + Number.EPSILON) * 10000) / 10000;
}

/**
 * Parse a money-ish string ("$1,234.50", " 1200 ") to a number. Returns null when
 * blank, NaN, or not finite — callers decide whether null means "omitted" or "invalid".
 */
export function parseMoney(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (s === "") return null;
  const n = Number(s.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseIntStrict(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (s === "") return null;
  if (!/^-?\d+$/.test(s)) return NaN as unknown as number; // signal "present but invalid"
  return Number(s);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface DebtValues {
  name: string;
  type: DebtType;
  balance: number;
  apr: number;
  min_payment: number;
  due_day: number | null;
  credit_limit: number | null;
  issuer: string | null;
  promo_apr: number | null;
  promo_until: string | null;
  deferred_interest: boolean;
  notes: string | null;
}

export interface ValidationResult<T> {
  ok: boolean;
  error: string | null;
  values: T | null;
}

/** Raw string-ish inputs straight off a FormData. */
export type RawFields = Record<string, FormDataEntryValue | null | undefined>;

function str(raw: FormDataEntryValue | null | undefined): string {
  return typeof raw === "string" ? raw.trim() : "";
}

/** Optional money field: blank → null; present-but-invalid or out-of-range → error string. */
function optionalMoney(
  raw: RawFields[string],
  label: string,
): { value: number | null; error: string | null } {
  const s = str(raw);
  if (s === "") return { value: null, error: null };
  const n = parseMoney(s);
  if (n === null) return { value: null, error: `${label} must be a number.` };
  if (n < 0) return { value: null, error: `${label} can't be negative.` };
  if (n > MONEY_MAX) return { value: null, error: `${label} is too large.` };
  return { value: round2(n), error: null };
}

export function validateDebtInput(fields: RawFields): ValidationResult<DebtValues> {
  const fail = (error: string): ValidationResult<DebtValues> => ({
    ok: false,
    error,
    values: null,
  });

  const name = str(fields.name);
  if (!name) return fail("Give the debt a name.");
  if (name.length > 120) return fail("Name is too long (max 120 characters).");

  const type = str(fields.type) as DebtType;
  if (!DEBT_TYPES.includes(type)) return fail("Choose a valid debt type.");

  // Balance — required.
  const balance = parseMoney(fields.balance);
  if (balance === null) return fail("Enter the current balance.");
  if (balance < 0) return fail("Balance can't be negative.");
  if (balance > MONEY_MAX) return fail("Balance is too large.");

  // APR — optional, percentage 0–99.9999.
  let apr = 0;
  {
    const s = str(fields.apr);
    if (s !== "") {
      const n = parseMoney(s);
      if (n === null) return fail("APR must be a number.");
      if (n < 0) return fail("APR can't be negative.");
      if (n > APR_MAX) return fail(`APR can't exceed ${APR_MAX}%.`);
      apr = round4(n);
    }
  }

  // Min payment — optional, defaults to 0.
  const minP = optionalMoney(fields.min_payment, "Minimum payment");
  if (minP.error) return fail(minP.error);

  // Due day — optional 1–31.
  let due_day: number | null = null;
  {
    const s = str(fields.due_day);
    if (s !== "") {
      const n = parseIntStrict(s);
      if (n === null || !Number.isInteger(n) || n < 1 || n > 31) {
        return fail("Due day must be a whole number from 1 to 31.");
      }
      due_day = n;
    }
  }

  const creditLimit = optionalMoney(fields.credit_limit, "Credit limit");
  if (creditLimit.error) return fail(creditLimit.error);

  const issuer = str(fields.issuer) || null;
  if (issuer && issuer.length > 120) return fail("Issuer is too long (max 120 characters).");

  // Promo APR — optional, same bounds as APR.
  let promo_apr: number | null = null;
  {
    const s = str(fields.promo_apr);
    if (s !== "") {
      const n = parseMoney(s);
      if (n === null) return fail("Promo APR must be a number.");
      if (n < 0) return fail("Promo APR can't be negative.");
      if (n > APR_MAX) return fail(`Promo APR can't exceed ${APR_MAX}%.`);
      promo_apr = round4(n);
    }
  }

  let promo_until: string | null = null;
  {
    const s = str(fields.promo_until);
    if (s !== "") {
      if (!ISO_DATE.test(s) || Number.isNaN(Date.parse(s)))
        return fail("Promo end date is invalid.");
      promo_until = s;
    }
  }

  const deferred_interest =
    str(fields.deferred_interest) === "on" || str(fields.deferred_interest) === "true";

  const notes = str(fields.notes) || null;
  if (notes && notes.length > 2000) return fail("Notes are too long (max 2000 characters).");

  return {
    ok: true,
    error: null,
    values: {
      name,
      type,
      balance: round2(balance),
      apr,
      min_payment: minP.value ?? 0,
      due_day,
      credit_limit: creditLimit.value,
      issuer,
      promo_apr,
      promo_until,
      deferred_interest,
      notes,
    },
  };
}

export interface TransactionValues {
  kind: TransactionKind;
  amount: number;
  occurred_on: string | null;
  note: string | null;
}

const TXN_KINDS: readonly TransactionKind[] = ["charge", "payment", "contribution"];

export function validateTransactionInput(fields: RawFields): ValidationResult<TransactionValues> {
  const fail = (error: string): ValidationResult<TransactionValues> => ({
    ok: false,
    error,
    values: null,
  });

  const kind = str(fields.kind) as TransactionKind;
  if (!TXN_KINDS.includes(kind)) return fail("Choose a transaction type.");

  const amount = parseMoney(fields.amount);
  if (amount === null) return fail("Enter an amount.");
  if (amount <= 0) return fail("Amount must be greater than zero.");
  if (amount > MONEY_MAX) return fail("Amount is too large.");

  let occurred_on: string | null = null;
  {
    const s = str(fields.occurred_on);
    if (s !== "") {
      if (!ISO_DATE.test(s) || Number.isNaN(Date.parse(s))) return fail("Date is invalid.");
      occurred_on = s;
    }
  }

  const note = str(fields.note) || null;
  if (note && note.length > 500) return fail("Note is too long (max 500 characters).");

  return { ok: true, error: null, values: { kind, amount: round2(amount), occurred_on, note } };
}
