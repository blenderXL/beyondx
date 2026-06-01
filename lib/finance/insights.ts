/**
 * Pure insight derivations (Phase 5). Distribution + utilization math used by the
 * insights dashboards. No I/O. Money/percentages are plain numbers; `pct` values are
 * fractions in [0,1].
 */

import { round2 } from "./validation";
import { DEBT_TYPE_LABELS, type DebtType } from "./types";

export interface InsightDebt {
  type: DebtType;
  balance: number;
  apr: number;
  credit_limit: number | null;
}

export interface DistributionSlice {
  type: DebtType;
  label: string;
  total: number;
  pct: number; // fraction of the grand total
}

/** Total balance grouped by debt type, descending, with each type's share of the total. */
export function debtDistribution(debts: InsightDebt[]): DistributionSlice[] {
  const totals = new Map<DebtType, number>();
  for (const d of debts) {
    if (d.balance <= 0) continue;
    totals.set(d.type, round2((totals.get(d.type) ?? 0) + d.balance));
  }
  const grand = [...totals.values()].reduce((s, v) => s + v, 0);
  if (grand <= 0) return [];
  return [...totals.entries()]
    .map(([type, total]) => ({ type, label: DEBT_TYPE_LABELS[type], total, pct: total / grand }))
    .sort((a, b) => b.total - a.total);
}

export interface AprBucket {
  label: string;
  total: number;
}

const APR_RANGES: { label: string; test: (apr: number) => boolean }[] = [
  { label: "Very low (<3%)", test: (a) => a < 3 },
  { label: "Low (3–7%)", test: (a) => a >= 3 && a < 7 },
  { label: "Mid (7–15%)", test: (a) => a >= 7 && a < 15 },
  { label: "High (15–20%)", test: (a) => a >= 15 && a < 20 },
  { label: "Very high (20%+)", test: (a) => a >= 20 },
];

/** Balances bucketed by APR band (only non-empty bands returned, in band order). */
export function aprBuckets(debts: InsightDebt[]): AprBucket[] {
  return APR_RANGES.map((range) => ({
    label: range.label,
    total: round2(
      debts.filter((d) => d.balance > 0 && range.test(d.apr)).reduce((s, d) => s + d.balance, 0),
    ),
  })).filter((b) => b.total > 0);
}

/** Overall credit-card utilization: sum of CC balances over sum of limits. Null if no limits. */
export function totalUtilization(debts: InsightDebt[]): number | null {
  let balance = 0;
  let limit = 0;
  for (const d of debts) {
    if (d.type !== "credit_card" || d.credit_limit === null || d.credit_limit <= 0) continue;
    balance += d.balance;
    limit += d.credit_limit;
  }
  if (limit <= 0) return null;
  return balance / limit;
}
