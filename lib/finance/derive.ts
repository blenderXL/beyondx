/**
 * Pure derivations for display: credit utilization and payoff progress. Both return
 * null when the inputs needed to compute them are missing, so the UI can hide the
 * stat rather than show a misleading 0%.
 */

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

/** "$1,234.50" — single place for USD formatting across the finance UI. */
export function formatUsd(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** "24.24%" — APR is stored as a percentage value. */
export function formatPercent(value: number): string {
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 4 })}%`;
}
