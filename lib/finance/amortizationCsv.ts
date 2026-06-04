/**
 * Build a CSV of the month-by-month payoff schedule: one row per month, one column per
 * debt (that month's payment), plus interest / remaining balance / total paid. Pure +
 * RFC-4180-escaped so it's unit-testable and safe for names with commas or quotes. Month
 * labels are passed in (the engine is date-free; the caller maps month index → calendar).
 */
import type { PayoffMonth } from "./payoff";

function escapeCsv(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildAmortizationCsv(
  debts: { id: string; name: string }[],
  schedule: PayoffMonth[],
  monthLabels: string[],
): string {
  const header = ["Month", ...debts.map((d) => d.name), "Interest", "Balance", "Total paid"];
  const rows = schedule.map((m, i) => [
    monthLabels[i] ?? String(m.month),
    ...debts.map((d) => (m.byDebt[d.id]?.payment ?? 0).toFixed(2)),
    m.totalInterest.toFixed(2),
    m.totalBalance.toFixed(2),
    m.totalPaid.toFixed(2),
  ]);
  return [header, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
}
