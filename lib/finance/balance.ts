/**
 * Balance reconciliation. The debt's `balance` is the live source of truth; logging
 * a transaction is a convenience that adjusts it. A charge raises the balance, a
 * payment lowers it (never below zero), and a savings contribution doesn't touch a
 * debt. Pure + unit-tested — the Server Action calls this inside one read-modify-write.
 */

import { round2 } from "@/lib/finance/validation";
import type { TransactionKind } from "@/lib/finance/types";

export function applyTransactionToBalance(
  current: number,
  kind: TransactionKind,
  amount: number,
): number {
  switch (kind) {
    case "charge":
      return round2(current + amount);
    case "payment":
      return Math.max(0, round2(current - amount));
    case "contribution":
      return round2(current); // no effect on a debt balance
  }
}
