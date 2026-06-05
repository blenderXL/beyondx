/**
 * Pure helpers for the Expenses hub's month switcher + historical view (Phase 5D). The hub
 * defaults to the current billing month (live + editable); picking a past month shows a
 * read-only summary of that month's recorded payments + contributions.
 */
import { round2 } from "./validation";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export interface MonthOption {
  /** First-of-month ISO date (the `billing_month` key), e.g. "2026-06-01". */
  value: string;
  /** Human label, e.g. "June 2026". */
  label: string;
}

/** The anchor month and `count - 1` prior months, newest first. `anchorMonth0` is 0-indexed. */
export function monthOptions(anchorYear: number, anchorMonth0: number, count: number): MonthOption[] {
  const out: MonthOption[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(anchorYear, anchorMonth0 - i, 1));
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    out.push({ value: `${y}-${String(m + 1).padStart(2, "0")}-01`, label: `${MONTHS[m]} ${y}` });
  }
  return out;
}

/** One recorded payment/contribution in a past month. */
export interface HistoryItem {
  id: string;
  name: string;
  kind: "payment" | "contribution";
  amount: number;
}

export function summarizeHistory(items: HistoryItem[]): { total: number; count: number } {
  return { total: round2(items.reduce((s, i) => s + i.amount, 0)), count: items.length };
}
