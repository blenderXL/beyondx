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
