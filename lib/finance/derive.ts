/**
 * Pure derivations for display: credit utilization and payoff progress. Both return
 * null when the inputs needed to compute them are missing, so the UI can hide the
 * stat rather than show a misleading 0%.
 */

import { round2 } from "./validation";
import type { Expense } from "./types";

/**
 * The dollar figure to show for one expense. A percent offering stores amount=0 and
 * carries `pct_of_income`, so its real value is that % of monthly income — without this
 * a percent offering reads as $0 in any raw `amount` sum (the offering-% total bug).
 */
export function expenseDisplayAmount(
  exp: Pick<Expense, "expense_group" | "pct_of_income" | "amount">,
  income: number,
): number {
  if (exp.expense_group === "offering" && exp.pct_of_income != null) {
    return round2((income * exp.pct_of_income) / 100);
  }
  return Number(exp.amount);
}

/** Fraction of the credit limit in use (0–1+), or null when there's no limit. */
export function utilization(balance: number, creditLimit: number | null): number | null {
  if (creditLimit === null || creditLimit <= 0) return null;
  return balance / creditLimit;
}

/** Fraction paid off (0–1) measured against the original balance, clamped. */
export function payoffProgress(balance: number, originalBalance: number | null): number | null {
  if (originalBalance === null || originalBalance <= 0) return null;
  const paid = 1 - balance / originalBalance;
  return Math.min(1, Math.max(0, paid));
}

/**
 * A suggested monthly minimum for a revolving balance: roughly 1% of the balance plus that
 * month's interest, floored at $25 (the common card-issuer formula). Shown as an editable
 * hint — it never overwrites a typed value. APR is a percentage (e.g. 24.24).
 */
export function suggestedMinimum(balance: number, apr: number): number {
  if (balance <= 0) return 0;
  const monthlyInterest = (balance * (apr / 100)) / 12;
  const raw = 0.01 * balance + monthlyInterest;
  return Math.max(25, Math.round((raw + Number.EPSILON) * 100) / 100);
}

/** "$1,234.50" — single place for USD formatting across the finance UI. */
export function formatUsd(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** "24.24%" — APR is stored as a percentage value. */
export function formatPercent(value: number): string {
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 4 })}%`;
}

/**
 * Due-date label for a debt card. Prefers the real `next_due_date` (formatted in UTC so
 * an ISO date never slips a day across timezones), falls back to the legacy `due_day`
 * ("day N"), and shows an em dash when neither is set. New debts only have
 * `next_due_date`, which is why the card showed "—" when it read `due_day` alone.
 */
export function formatDueDate(nextDueDate: string | null, dueDay: number | null): string {
  if (nextDueDate) {
    const d = new Date(`${nextDueDate}T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    }
  }
  return dueDay ? `day ${dueDay}` : "—";
}
