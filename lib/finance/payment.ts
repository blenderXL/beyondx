/**
 * Pure payment-split engine (Phase 4). The amount a user pays on a debt is the TOTAL
 * monthly payment; only the principal portion reduces the balance. The rest is the
 * month's interest plus (for a mortgage) optional escrow + PMI that go elsewhere.
 *
 *   interest  = balance × (APR/100) / 12        (this month, on the current balance)
 *   principal = total − escrow − PMI − interest (floored at 0, capped at the balance)
 *
 * No I/O. The check-off flow (Phase 5) uses `principal` to draw the balance down and
 * records the split on the transaction; the debt card shows the breakdown so the user
 * sees why a payment moves the balance by less than they paid.
 */

import { round2 } from "./validation";

export interface PaymentSplit {
  interest: number;
  escrow: number;
  pmi: number;
  principal: number;
}

export function splitPayment(input: {
  balance: number;
  apr: number; // percentage, e.g. 6.625
  total: number; // the total monthly payment
  escrow?: number;
  pmi?: number;
}): PaymentSplit {
  const balance = input.balance;
  const escrow = Math.max(0, input.escrow ?? 0);
  const pmi = Math.max(0, input.pmi ?? 0);
  const interest = balance > 0 ? round2((balance * (input.apr / 100)) / 12) : 0;
  // What's left after escrow/PMI/interest goes to principal — never negative, never more
  // than is actually owed.
  const principal = Math.min(balance > 0 ? balance : 0, Math.max(0, round2(input.total - escrow - pmi - interest)));
  return { interest, escrow, pmi, principal };
}
