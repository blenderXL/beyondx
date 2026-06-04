/**
 * Finance entity types for Phase 1 (Debt management). Mirrors the columns in
 * `0002_finance_tables.sql` + `0003_debts_and_transactions.sql`. Money is a JS
 * number (numeric(14,2) fits comfortably in a double); APR is a percentage value
 * (e.g. 24.24 → "24.24%"), stored as numeric(6,4) so the range is 0–99.9999.
 * Income / Expense / SavingsGoal types land with their Phase 2 CRUD.
 */

export type DebtType =
  | "loan_401k"
  | "auto"
  | "savings_club"
  | "credit_card"
  | "home_equity"
  | "medical"
  | "mortgage"
  | "personal_loan"
  | "student"
  | "loan"
  | "other";

/** Dropdown order (matches the product's debt-type list; "Loan (other)" + "Other" last). */
export const DEBT_TYPES: readonly DebtType[] = [
  "loan_401k",
  "auto",
  "savings_club",
  "credit_card",
  "home_equity",
  "medical",
  "mortgage",
  "personal_loan",
  "student",
  "loan",
  "other",
] as const;

export const DEBT_TYPE_LABELS: Record<DebtType, string> = {
  loan_401k: "401(k) Loan",
  auto: "Auto/Trailer/Vehicle Loan (secured)",
  savings_club: "Christmas/Savings Club",
  credit_card: "Credit Card/Line (unsecured)",
  home_equity: "Home Equity Loan",
  medical: "Medical Bill",
  mortgage: "Mortgage",
  personal_loan: "Personal Loan",
  student: "Student Loan",
  loan: "Loan (other)",
  other: "Other",
};

/**
 * Conditional-field rules shared by the form and the server validator (single source
 * of truth — add a rule here and both honor it).
 */
export const DEBT_TYPES_WITHOUT_DUE_DATE: readonly DebtType[] = ["medical", "savings_club"];

/** Credit limit is only meaningful for revolving credit. */
export function creditLimitApplies(type: DebtType): boolean {
  return type === "credit_card";
}

/** Next due date is shown/required for every type except the exempt ones. */
export function dueDateApplies(type: DebtType): boolean {
  return !DEBT_TYPES_WITHOUT_DUE_DATE.includes(type);
}

/** Issuer + promotional-financing fields only apply to revolving credit. */
export function cardExtrasApply(type: DebtType): boolean {
  return type === "credit_card";
}

/** Installment debts can carry an explicit starting balance + loan start date. */
const TYPES_WITH_START_DETAILS: readonly DebtType[] = [
  "mortgage",
  "auto",
  "home_equity",
  "personal_loan",
  "student",
];
export function startDetailsApply(type: DebtType): boolean {
  return TYPES_WITH_START_DETAILS.includes(type);
}

/** Higher-level groupings of debt types for the category view + category breakdown. */
export type DebtBucket = "credit_cards" | "mortgage" | "auto" | "loans" | "other";

export const DEBT_BUCKETS: readonly DebtBucket[] = [
  "credit_cards",
  "mortgage",
  "auto",
  "loans",
  "other",
] as const;

export const DEBT_BUCKET_LABELS: Record<DebtBucket, string> = {
  credit_cards: "Credit cards",
  mortgage: "Mortgage & home",
  auto: "Auto",
  loans: "Loans",
  other: "Other",
};

const TYPE_TO_BUCKET: Record<DebtType, DebtBucket> = {
  credit_card: "credit_cards",
  mortgage: "mortgage",
  home_equity: "mortgage",
  auto: "auto",
  personal_loan: "loans",
  student: "loans",
  loan_401k: "loans",
  loan: "loans",
  medical: "other",
  savings_club: "other",
  other: "other",
};

/** The higher-level bucket a debt type rolls up into. */
export function typeBucket(type: DebtType): DebtBucket {
  return TYPE_TO_BUCKET[type];
}

/** Charges raise a debt's balance; payments lower it. `contribution` is reserved for Phase 2 savings. */
export type TransactionKind = "charge" | "payment" | "contribution";

export interface Debt {
  id: string;
  profile_id: string;
  name: string;
  type: DebtType;
  balance: number;
  apr: number;
  min_payment: number;
  due_day: number | null;
  /** Next payment due date (ISO). Supersedes due_day for new debts; due_day kept for back-compat. */
  next_due_date: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  credit_limit: number | null;
  original_balance: number | null;
  /** Optional loan/account start date (installment debts) — migration 0011. */
  start_date: string | null;
  issuer: string | null;
  promo_apr: number | null;
  promo_until: string | null;
  deferred_interest: boolean;
  payoff_order: number | null;
  notes: string | null;
}

export interface Transaction {
  id: string;
  profile_id: string;
  debt_id: string | null;
  expense_id: string | null;
  savings_goal_id: string | null;
  kind: TransactionKind;
  amount: number;
  occurred_on: string;
  billing_month: string | null;
  note: string | null;
  created_at: string;
}

/* ---- Phase 2: income (+ tithe), expenses (+ group/payee), savings pots ---- */

export type IncomeCadence =
  | "weekly"
  | "biweekly"
  | "semimonthly"
  | "monthly"
  | "annual"
  | "one_time";

export const INCOME_CADENCES: readonly IncomeCadence[] = [
  "weekly",
  "biweekly",
  "semimonthly",
  "monthly",
  "annual",
  "one_time",
] as const;

export const INCOME_CADENCE_LABELS: Record<IncomeCadence, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  semimonthly: "Twice a month",
  monthly: "Monthly",
  annual: "Annual",
  one_time: "One-time",
};

/** Offerings/tithing: a % of the paycheck, a fixed $ amount, or off. */
export type TitheMode = "none" | "percent" | "fixed";
export const TITHE_MODES: readonly TitheMode[] = ["none", "percent", "fixed"] as const;

export interface Income {
  id: string;
  profile_id: string;
  source: string;
  amount: number;
  cadence: IncomeCadence;
  tithe_mode: TitheMode;
  /** percent (0–100) when tithe_mode='percent'; dollar amount when 'fixed'; null when 'none'. */
  tithe_value: number | null;
  pay_day: number | null;
  /** A variable source uses a per-month override (see `IncomeOverride`) when one exists. */
  is_variable: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

/** A per-month actual amount for a variable income source (migration 0010). */
export interface IncomeOverride {
  id: string;
  profile_id: string;
  income_id: string;
  /** First-of-month ISO date the override applies to. */
  billing_month: string;
  amount: number;
  created_at: string;
}

export type ExpenseCadence =
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "annual"
  | "one_time";

export const EXPENSE_CADENCES: readonly ExpenseCadence[] = [
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "annual",
  "one_time",
] as const;

export const EXPENSE_CADENCE_LABELS: Record<ExpenseCadence, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
  one_time: "One-time",
};

/** Rollup buckets — the spreadsheet's "Utils PMT / insurance / …" groupings. */
export type ExpenseGroup =
  | "utility"
  | "insurance"
  | "housing"
  | "credit_card"
  | "transportation"
  | "food"
  | "healthcare"
  | "subscription"
  | "loan"
  | "offering"
  | "personal"
  | "other";

export const EXPENSE_GROUPS: readonly ExpenseGroup[] = [
  "utility",
  "insurance",
  "housing",
  "credit_card",
  "transportation",
  "food",
  "healthcare",
  "subscription",
  "loan",
  "offering",
  "personal",
  "other",
] as const;

export const EXPENSE_GROUP_LABELS: Record<ExpenseGroup, string> = {
  utility: "Utility",
  insurance: "Insurance",
  housing: "Housing",
  credit_card: "Credit card",
  transportation: "Transportation",
  food: "Food & groceries",
  healthcare: "Healthcare",
  subscription: "Subscription",
  loan: "Loan",
  offering: "Offering",
  personal: "Personal",
  other: "Other",
};

export interface Expense {
  id: string;
  profile_id: string;
  category: string;
  amount: number;
  cadence: ExpenseCadence;
  expense_group: ExpenseGroup | null;
  payee: string | null;
  due_day: number | null;
  /** Optional link to a debt — paying this expense (in the Budget) draws down that debt. */
  debt_id: string | null;
  /** For an "offering" expense: a percent (0–100) of total monthly income instead of a fixed amount. */
  pct_of_income: number | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavingsGoal {
  id: string;
  profile_id: string;
  name: string;
  target_amount: number | null;
  current_amount: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}
