/**
 * Reconstructs a debt's month-end balance series for a tiny card sparkline. The live balance
 * is the source of truth, so we walk the transactions backwards to derive the pre-history
 * balance, then replay them forward, snapshotting at each month boundary.
 *
 * It's an approximation: a payment that floored at zero can't be reversed exactly, but for a
 * month-to-month trend glyph that's fine. Returns oldest→newest; fewer than 2 points means
 * "not enough history" (the caller hides the chart).
 */
import { round2 } from "@/lib/finance/validation";
import type { TransactionKind } from "@/lib/finance/types";

export interface BalanceTxn {
  kind: TransactionKind;
  amount: number;
  /** ISO date (YYYY-MM-DD). */
  occurredOn: string;
}

export function monthlyBalanceSeries(currentBalance: number, txns: BalanceTxn[]): number[] {
  // Only charges/payments move a debt balance; contributions don't.
  const moving = txns.filter((t) => t.kind === "charge" || t.kind === "payment");
  if (moving.length === 0) return [];

  const asc = [...moving].sort((a, b) => a.occurredOn.localeCompare(b.occurredOn));

  // Reverse from the current balance back to before the earliest transaction.
  let start = currentBalance;
  for (const t of asc) {
    start = t.kind === "payment" ? start + t.amount : start - t.amount;
  }
  start = Math.max(0, round2(start));

  // Replay forward, recording the end-of-month balance for each month with activity.
  const months: string[] = [];
  const monthEnd = new Map<string, number>();
  let bal = start;
  for (const t of asc) {
    const m = t.occurredOn.slice(0, 7); // YYYY-MM
    bal = t.kind === "payment" ? Math.max(0, round2(bal - t.amount)) : round2(bal + t.amount);
    if (!monthEnd.has(m)) months.push(m);
    monthEnd.set(m, bal);
  }

  return [start, ...months.map((m) => monthEnd.get(m)!)];
}
