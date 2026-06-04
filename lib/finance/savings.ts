/**
 * Pure savings derivations. Contributions are `contribution` transactions tagged with a
 * `savings_goal_id`; the trajectory is the cumulative total saved at the end of each month.
 * No I/O — the page supplies the contribution rows + the month window.
 */

import { round2 } from "@/lib/finance/validation";

export interface MonthlyContribution {
  /** "YYYY-MM" the contribution occurred in. */
  month: string;
  amount: number;
}

/**
 * Cumulative saved total at the end of each window month (oldest → newest). Contributions
 * before the window are folded into the opening total, so the line starts at the real
 * running balance rather than zero. `windowMonths` is an ascending list of "YYYY-MM".
 */
export function cumulativeByMonth(
  contributions: MonthlyContribution[],
  windowMonths: string[],
): number[] {
  return windowMonths.map((m) =>
    round2(
      contributions.reduce((sum, c) => (c.month <= m ? sum + c.amount : sum), 0),
    ),
  );
}

/** The last `count` months as ascending "YYYY-MM", ending at `anchor` (a "YYYY-MM-01" date). */
export function recentMonths(anchorYear: number, anchorMonthIndex0: number, count: number): string[] {
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(anchorYear, anchorMonthIndex0 - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}
