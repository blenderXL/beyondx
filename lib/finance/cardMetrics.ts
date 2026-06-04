/**
 * The stat row shown on a debt card adapts to the debt type. Every card shows APR / Min /
 * Due; the 4th stat is credit-utilization for cards, "% paid off" for amortizing debts
 * (mortgage / auto / home-equity / personal / student), and is omitted for the rest
 * (medical / savings-club / other / generic loans) — a 3-stat layout. Pure + unit-tested.
 */
import { formatUsd, formatPercent, formatDueDate, utilization, payoffProgress } from "./derive";
import type { Debt, DebtType } from "./types";

export interface CardMetric {
  label: string;
  value: string;
}

const AMORTIZING: readonly DebtType[] = ["mortgage", "auto", "home_equity", "personal_loan", "student"];

export function cardMetricsFor(debt: Debt): CardMetric[] {
  const metrics: CardMetric[] = [
    { label: "APR", value: formatPercent(Number(debt.apr)) },
    { label: "Min", value: formatUsd(Number(debt.min_payment)) },
    { label: "Due", value: formatDueDate(debt.next_due_date, debt.due_day) },
  ];

  if (debt.type === "credit_card") {
    const util = utilization(
      Number(debt.balance),
      debt.credit_limit === null ? null : Number(debt.credit_limit),
    );
    metrics.push({ label: "Util", value: util === null ? "—" : `${Math.round(util * 100)}%` });
  } else if (AMORTIZING.includes(debt.type)) {
    const progress = payoffProgress(
      Number(debt.balance),
      debt.original_balance === null ? null : Number(debt.original_balance),
    );
    metrics.push({ label: "Paid", value: progress === null ? "—" : `${Math.round(progress * 100)}%` });
  }

  return metrics;
}
