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
