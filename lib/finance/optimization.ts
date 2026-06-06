/**
 * Deterministic "optimization insight" for the Debts page: with a little extra per month on
 * the chosen payoff method, how much interest does the user save — and which debt gets that
 * extra first (the method's #1 target)? Pure; reuses the payoff simulator.
 */

import { computePayoff, orderDebts, type PayoffDebtInput, type PayoffMethod } from "./payoff";
import { round2 } from "./validation";

export interface ExtraPaymentInsight {
  /** The debt the chosen method directs the extra payment to first. */
  debtName: string;
  /** Extra dollars per month modeled. */
  extra: number;
  /** Interest saved vs. paying only the minimums, over the life of the plan. */
  interestSaved: number;
}

/**
 * Compare minimums-only vs. minimums + `extra`/mo under `method`. Returns the saving and the
 * method's first-target debt, or null when there's nothing to show (no debts, infeasible, or
 * no positive saving).
 */
export function bestExtraPaymentInsight(
  debts: PayoffDebtInput[],
  method: PayoffMethod,
  extra = 100,
): ExtraPaymentInsight | null {
  if (debts.length === 0) return null;
  const totalMin = Math.round(debts.reduce((s, d) => s + d.min_payment, 0));
  const base = computePayoff(debts, totalMin, method);
  const boosted = computePayoff(debts, totalMin + extra, method);
  if (!base.feasible || !boosted.feasible) return null;
  const interestSaved = round2(base.totalInterest - boosted.totalInterest);
  if (interestSaved <= 0) return null;
  const target = orderDebts(debts, method)[0];
  if (!target) return null;
  return { debtName: target.name, extra, interestSaved };
}
