/**
 * Finance entity types for Phase 1 (Debt management). Mirrors the columns in
 * `0002_finance_tables.sql` + `0003_debts_and_transactions.sql`. Money is a JS
 * number (numeric(14,2) fits comfortably in a double); APR is a percentage value
 * (e.g. 24.24 → "24.24%"), stored as numeric(6,4) so the range is 0–99.9999.
 * Income / Expense / SavingsGoal types land with their Phase 2 CRUD.
 */

export type DebtType =
  | "credit_card"
  | "loan"
  | "mortgage"
  | "student"
  | "auto"
  | "medical"
  | "other";

export const DEBT_TYPES: readonly DebtType[] = [
  "credit_card",
  "loan",
  "mortgage",
  "student",
  "auto",
  "medical",
  "other",
] as const;

export const DEBT_TYPE_LABELS: Record<DebtType, string> = {
  credit_card: "Credit card",
  loan: "Loan",
  mortgage: "Mortgage",
  student: "Student loan",
  auto: "Auto loan",
  medical: "Medical",
  other: "Other",
};

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
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  credit_limit: number | null;
  original_balance: number | null;
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
  archived_at: string | null;
  created_at: string;
  updated_at: string;
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
  | "subscription"
  | "loan"
  | "other";

export const EXPENSE_GROUPS: readonly ExpenseGroup[] = [
  "utility",
  "insurance",
  "housing",
  "subscription",
  "loan",
  "other",
] as const;

export const EXPENSE_GROUP_LABELS: Record<ExpenseGroup, string> = {
  utility: "Utility",
  insurance: "Insurance",
  housing: "Housing",
  subscription: "Subscription",
  loan: "Loan",
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
