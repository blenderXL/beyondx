/**
 * Pure, dependency-free validators for the finance forms. Enforced server-side in
 * the Server Actions (untrusted input) and unit-tested in isolation. The browser
 * gets immediate feedback from native HTML constraints; these are the real gate.
 */

import {
  DEBT_TYPES,
  dueDateApplies,
  EXPENSE_CADENCES,
  EXPENSE_GROUPS,
  INCOME_CADENCES,
  TITHE_MODES,
  type DebtType,
  type ExpenseCadence,
  type ExpenseGroup,
  type IncomeCadence,
  type TitheMode,
  type TransactionKind,
} from "@/lib/finance/types";

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
 * Parse a money-ish / rate-ish string ("$1,234.50", " 1200 ", "20.74%") to a number.
 * Strips `$`, `,`, `%`, and whitespace so the same parser serves money fields and the
 * interest-rate field (which legitimately carries a trailing `%`). Returns null when
 * blank, NaN, or not finite — callers decide whether null means "omitted" or "invalid".
 */
export function parseMoney(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (s === "") return null;
  const n = Number(s.replace(/[$,%\s]/g, ""));
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
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface DebtValues {
  name: string;
  type: DebtType;
  balance: number;
  apr: number;
  min_payment: number;
  next_due_date: string | null;
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

export function validateDebtInput(
  fields: RawFields,
  mode: "create" | "update" = "create",
): ValidationResult<DebtValues> {
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

  // Next due date — ISO date. Required on create for non-exempt types (medical /
  // savings-club are exempt); lenient on update so editing a legacy debt isn't blocked.
  let next_due_date: string | null = null;
  {
    const s = str(fields.next_due_date);
    if (s === "") {
      if (mode === "create" && dueDateApplies(type)) {
        return fail("A next due date is required for this debt type.");
      }
    } else if (!ISO_DATE.test(s) || Number.isNaN(Date.parse(s))) {
      return fail("Next due date is invalid.");
    } else {
      next_due_date = s;
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
      next_due_date,
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

/** Optional day-of-month (1–31): blank → null; present-but-invalid → error. */
function optionalDayOfMonth(
  raw: RawFields[string],
  label: string,
): { value: number | null; error: string | null } {
  const s = str(raw);
  if (s === "") return { value: null, error: null };
  const n = parseIntStrict(s);
  if (n === null || !Number.isInteger(n) || n < 1 || n > 31) {
    return { value: null, error: `${label} must be a whole number from 1 to 31.` };
  }
  return { value: n, error: null };
}

export interface IncomeValues {
  source: string;
  amount: number;
  cadence: IncomeCadence;
  tithe_mode: TitheMode;
  tithe_value: number | null;
  pay_day: number | null;
}

export function validateIncomeInput(fields: RawFields): ValidationResult<IncomeValues> {
  const fail = (error: string): ValidationResult<IncomeValues> => ({ ok: false, error, values: null });

  const source = str(fields.source);
  if (!source) return fail("Give the income source a name.");
  if (source.length > 120) return fail("Source is too long (max 120 characters).");

  const amount = parseMoney(fields.amount);
  if (amount === null) return fail("Enter the income amount.");
  if (amount < 0) return fail("Amount can't be negative.");
  if (amount > MONEY_MAX) return fail("Amount is too large.");

  const cadence = str(fields.cadence) as IncomeCadence;
  if (!INCOME_CADENCES.includes(cadence)) return fail("Choose a valid pay frequency.");

  // Offerings moved to an expense group (see migration 0009); income no longer collects a
  // tithe, so an absent field defaults to "none". The column stays for one release.
  const tithe_mode = (str(fields.tithe_mode) || "none") as TitheMode;
  if (!TITHE_MODES.includes(tithe_mode)) return fail("Choose a valid offering option.");

  let tithe_value: number | null = null;
  if (tithe_mode === "percent") {
    const n = parseMoney(fields.tithe_value);
    if (n === null) return fail("Enter the offering percentage.");
    if (n < 0 || n > 100) return fail("Offering percentage must be between 0 and 100.");
    tithe_value = round4(n);
  } else if (tithe_mode === "fixed") {
    const n = parseMoney(fields.tithe_value);
    if (n === null) return fail("Enter the offering amount.");
    if (n < 0) return fail("Offering amount can't be negative.");
    if (n > MONEY_MAX) return fail("Offering amount is too large.");
    tithe_value = round2(n);
  }

  const payDay = optionalDayOfMonth(fields.pay_day, "Pay day");
  if (payDay.error) return fail(payDay.error);

  return {
    ok: true,
    error: null,
    values: { source, amount: round2(amount), cadence, tithe_mode, tithe_value, pay_day: payDay.value },
  };
}

export interface ExpenseValues {
  category: string;
  amount: number;
  cadence: ExpenseCadence;
  expense_group: ExpenseGroup | null;
  payee: string | null;
  due_day: number | null;
  debt_id: string | null;
  pct_of_income: number | null;
}

export function validateExpenseInput(fields: RawFields): ValidationResult<ExpenseValues> {
  const fail = (error: string): ValidationResult<ExpenseValues> => ({ ok: false, error, values: null });

  const category = str(fields.category);
  if (!category) return fail("Give the expense a name.");
  if (category.length > 120) return fail("Name is too long (max 120 characters).");

  const amount = parseMoney(fields.amount);
  if (amount === null) return fail("Enter the expense amount.");
  if (amount < 0) return fail("Amount can't be negative.");
  if (amount > MONEY_MAX) return fail("Amount is too large.");

  const cadence = str(fields.cadence) as ExpenseCadence;
  if (!EXPENSE_CADENCES.includes(cadence)) return fail("Choose a valid frequency.");

  let expense_group: ExpenseGroup | null = null;
  {
    const s = str(fields.expense_group);
    if (s !== "") {
      if (!EXPENSE_GROUPS.includes(s as ExpenseGroup)) return fail("Choose a valid group.");
      expense_group = s as ExpenseGroup;
    }
  }

  const payee = str(fields.payee) || null;
  if (payee && payee.length > 120) return fail("Payee is too long (max 120 characters).");

  const dueDay = optionalDayOfMonth(fields.due_day, "Pay day");
  if (dueDay.error) return fail(dueDay.error);

  // Optional link to a debt; ownership of the referenced debt is enforced in the action.
  let debt_id: string | null = null;
  {
    const s = str(fields.debt_id);
    if (s !== "") {
      if (!UUID.test(s)) return fail("Choose a valid debt to link.");
      debt_id = s;
    }
  }

  // Percent-of-income only applies to an "offering" expense; ignored (nulled) otherwise.
  let pct_of_income: number | null = null;
  if (expense_group === "offering") {
    const s = str(fields.pct_of_income);
    if (s !== "") {
      const n = parseMoney(s);
      if (n === null) return fail("Offering percent must be a number.");
      if (n < 0 || n > 100) return fail("Offering percent must be between 0 and 100.");
      pct_of_income = round4(n);
    }
  }

  return {
    ok: true,
    error: null,
    values: {
      category,
      amount: round2(amount),
      cadence,
      expense_group,
      payee,
      due_day: dueDay.value,
      debt_id,
      pct_of_income,
    },
  };
}

export interface SavingsGoalValues {
  name: string;
  target_amount: number | null;
  current_amount: number;
}

export function validateSavingsGoalInput(fields: RawFields): ValidationResult<SavingsGoalValues> {
  const fail = (error: string): ValidationResult<SavingsGoalValues> => ({ ok: false, error, values: null });

  const name = str(fields.name);
  if (!name) return fail("Give the savings pot a name.");
  if (name.length > 120) return fail("Name is too long (max 120 characters).");

  const target = optionalMoney(fields.target_amount, "Target");
  if (target.error) return fail(target.error);

  const current = optionalMoney(fields.current_amount, "Current amount");
  if (current.error) return fail(current.error);

  return {
    ok: true,
    error: null,
    values: { name, target_amount: target.value, current_amount: current.value ?? 0 },
  };
}
