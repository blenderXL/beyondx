/**
 * Pure, deterministic debt-payoff engine (Phase 4). No I/O, no dates — month indices
 * only; the caller maps month 1..N onto calendar months. Fixed-budget model: every
 * month the user puts `monthlyBudget` toward debt; minimum payments come first, the
 * remainder ("extra") cascades into the target debt by `method` order. When a debt is
 * cleared its minimum is freed automatically (the budget is fixed), which is the
 * snowball/avalanche acceleration. Money is rounded to cents at each step to match the
 * `numeric(14,2)` columns.
 */

import { round2 } from "./validation";
import type { DebtType } from "./types";

export type PayoffMethod =
  | "snowball"
  | "avalanche"
  | "cfi"
  | "highest_balance"
  | "highest_payment"
  | "custom";

/** The strategies the user can pick, with UI copy. Order is the select order. */
export const PAYOFF_METHODS: { value: PayoffMethod; label: string; blurb: string }[] = [
  { value: "avalanche", label: "Avalanche", blurb: "Highest APR first — least interest paid." },
  { value: "snowball", label: "Snowball", blurb: "Smallest balance first — fastest wins." },
  { value: "cfi", label: "Cash-flow index", blurb: "Balance ÷ min payment — frees monthly cash fastest." },
  { value: "highest_balance", label: "Highest balance", blurb: "Largest balances first — clears big debts." },
  { value: "highest_payment", label: "Highest payment", blurb: "Largest minimum first — frees the most cash soonest." },
  { value: "custom", label: "Custom order", blurb: "Your own ranked order." },
];

/** What an unset/legacy `profiles.payoff_method` (null) resolves to. */
export const DEFAULT_PAYOFF_METHOD: PayoffMethod = "avalanche";

export function isPayoffMethod(v: unknown): v is PayoffMethod {
  return typeof v === "string" && PAYOFF_METHODS.some((m) => m.value === v);
}

/** Coerce a stored/posted value to a valid method, defaulting when null/unknown/tampered. */
export function resolvePayoffMethod(v: unknown): PayoffMethod {
  return isPayoffMethod(v) ? v : DEFAULT_PAYOFF_METHOD;
}

export interface PayoffDebtInput {
  id: string;
  name: string;
  balance: number;
  apr: number; // percentage, e.g. 24.24
  min_payment: number;
  payoff_order?: number | null;
  /** Optional — carried through only so the UI can show a per-type icon; engine ignores it. */
  type?: DebtType;
}

/** Per-debt detail for one month of the schedule (for the amortization table / CSV). */
export interface PayoffDebtMonth {
  payment: number;
  balance: number;
  interest: number;
}

export interface PayoffMonth {
  month: number;
  totalBalance: number;
  totalInterest: number;
  totalPaid: number;
  /** Keyed by debt id — every debt appears each month (paid-off debts read 0/0/balance≈0). */
  byDebt: Record<string, PayoffDebtMonth>;
}

export interface PayoffResult {
  feasible: boolean;
  months: number;
  totalInterest: number;
  schedule: PayoffMonth[];
  perDebtPayoffMonth: Record<string, number>;
}

const ACTIVE = 0.005; // a balance at/below half a cent is "paid off"
const MAX_MONTHS = 1200; // 100-year guard against a budget that never amortizes

/** Order debts by the chosen strategy. A deterministic tie-break keeps equal keys stable. */
export function orderDebts<
  T extends { balance: number; apr: number; min_payment: number; payoff_order?: number | null },
>(debts: T[], method: PayoffMethod): T[] {
  const copy = [...debts];
  // Ties resolve to highest APR, then smallest balance — so the ordering is fully determined.
  const tie = (a: T, b: T) => b.apr - a.apr || a.balance - b.balance;
  switch (method) {
    case "snowball": // smallest balance first
      return copy.sort((a, b) => a.balance - b.balance || tie(a, b));
    case "avalanche": // highest APR first
      return copy.sort((a, b) => b.apr - a.apr || tie(a, b));
    case "highest_balance": // largest balance first
      return copy.sort((a, b) => b.balance - a.balance || tie(a, b));
    case "highest_payment": // largest minimum payment first
      return copy.sort((a, b) => b.min_payment - a.min_payment || tie(a, b));
    case "cfi": {
      // Cash-flow index = balance ÷ minimum payment; lowest first frees monthly cash fastest.
      // A zero-minimum debt has an infinite index, so it sorts last.
      const cfi = (x: T) => (x.min_payment > 0 ? x.balance / x.min_payment : Number.POSITIVE_INFINITY);
      return copy.sort((a, b) => cfi(a) - cfi(b) || tie(a, b));
    }
    case "custom":
    default: // ascending payoff_order, nulls last
      return copy.sort((a, b) => {
        const ao = a.payoff_order ?? Number.POSITIVE_INFINITY;
        const bo = b.payoff_order ?? Number.POSITIVE_INFINITY;
        return ao - bo || tie(a, b);
      });
  }
}

interface Sim {
  id: string;
  balance: number;
  apr: number;
  min_payment: number;
  payoff_order: number | null;
}

export function computePayoff(
  debts: PayoffDebtInput[],
  monthlyBudget: number,
  method: PayoffMethod,
): PayoffResult {
  const sims: Sim[] = debts.map((d) => ({
    id: d.id,
    balance: round2(d.balance),
    apr: d.apr,
    min_payment: d.min_payment,
    payoff_order: d.payoff_order ?? null,
  }));

  const perDebtPayoffMonth: Record<string, number> = {};
  for (const s of sims) if (s.balance <= ACTIVE) perDebtPayoffMonth[s.id] = 0;

  const schedule: PayoffMonth[] = [];
  let totalInterest = 0;
  let prevTotal = sims.reduce((sum, s) => sum + s.balance, 0);

  if (prevTotal <= ACTIVE) {
    return { feasible: true, months: 0, totalInterest: 0, schedule, perDebtPayoffMonth };
  }

  for (let month = 1; month <= MAX_MONTHS; month++) {
    const active = sims.filter((s) => s.balance > ACTIVE);
    if (active.length === 0) break;

    // 1. Accrue interest.
    let interestThisMonth = 0;
    const interestByDebt = new Map<string, number>();
    for (const s of active) {
      const interest = round2((s.balance * s.apr) / 100 / 12);
      s.balance = round2(s.balance + interest);
      interestThisMonth = round2(interestThisMonth + interest);
      interestByDebt.set(s.id, interest);
    }

    // 2. Minimum payments (capped at the balance). Infeasible if the budget can't cover them.
    let sumMin = 0;
    const minDue = new Map<string, number>();
    for (const s of active) {
      const due = Math.min(s.min_payment, s.balance);
      minDue.set(s.id, round2(due));
      sumMin = round2(sumMin + due);
    }
    if (monthlyBudget < sumMin - 0.005) {
      return { feasible: false, months: schedule.length, totalInterest, schedule, perDebtPayoffMonth };
    }
    for (const s of active) s.balance = round2(s.balance - (minDue.get(s.id) ?? 0));

    // 3. Extra cascades into the target debts by method order.
    let extra = round2(monthlyBudget - sumMin);
    const extraByDebt = new Map<string, number>();
    for (const s of orderDebts(active, method)) {
      if (extra <= ACTIVE) break;
      if (s.balance <= ACTIVE) continue;
      const pay = Math.min(extra, s.balance);
      s.balance = round2(s.balance - pay);
      extra = round2(extra - pay);
      extraByDebt.set(s.id, round2((extraByDebt.get(s.id) ?? 0) + pay));
    }

    // 4. Record payoffs, per-debt rows, and the month's totals.
    for (const s of active) {
      if (s.balance <= ACTIVE && perDebtPayoffMonth[s.id] === undefined) perDebtPayoffMonth[s.id] = month;
    }
    const byDebt: Record<string, PayoffDebtMonth> = {};
    for (const s of sims) {
      byDebt[s.id] = {
        payment: round2((minDue.get(s.id) ?? 0) + (extraByDebt.get(s.id) ?? 0)),
        balance: round2(Math.max(0, s.balance)),
        interest: interestByDebt.get(s.id) ?? 0,
      };
    }
    const totalBalance = round2(sims.reduce((sum, s) => sum + Math.max(0, s.balance), 0));
    const totalPaid = round2(monthlyBudget - extra);
    totalInterest = round2(totalInterest + interestThisMonth);
    schedule.push({ month, totalBalance, totalInterest: interestThisMonth, totalPaid, byDebt });

    if (totalBalance <= ACTIVE) break;
    // No meaningful progress → the budget only services interest. Infeasible.
    if (month >= 2 && totalBalance >= prevTotal - 0.005) {
      return { feasible: false, months: schedule.length, totalInterest, schedule, perDebtPayoffMonth };
    }
    prevTotal = totalBalance;
  }

  const cleared = sims.every((s) => s.balance <= ACTIVE);
  return {
    feasible: cleared,
    months: cleared ? schedule.length : schedule.length,
    totalInterest,
    schedule,
    perDebtPayoffMonth,
  };
}
