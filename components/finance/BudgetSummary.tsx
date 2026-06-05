import { StatCard } from "@/components/layout/StatCard";
import { formatUsd } from "@/lib/finance/derive";
import { labelClass } from "@/components/finance/formStyles";
import type { MonthlyPlan, CycleBreakdown, Cycle } from "@/lib/finance/planner";

const CYCLE_LABELS: Record<Cycle, string> = {
  first: "1st-of-month",
  mid: "15th",
  none: "Unscheduled",
};

function CycleColumn({ title, b }: { title: string; b: CycleBreakdown }) {
  const rows: [string, number][] = [
    ["Income", b.income],
    ["Offerings", -b.offerings],
    ["Expenses", -b.expenses],
    ["Min. debt payments", -b.minimums],
  ];
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">{title}</p>
      <dl className="mt-4 space-y-2 font-mono text-[12px]">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4">
            <dt className="text-[var(--color-text-muted)]">{label}</dt>
            <dd className="tabular-nums text-[var(--color-text-secondary)]">
              {value < 0 ? "−" : ""}
              {formatUsd(Math.abs(value))}
            </dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-4 border-t border-[var(--color-border-subtle)] pt-2">
          <dt className="text-[var(--color-text-primary)]">Left</dt>
          <dd
            className="tabular-nums"
            style={{ color: b.leftover < 0 ? "var(--color-accent-red)" : "var(--color-accent-emerald)" }}
          >
            {formatUsd(b.leftover)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

/**
 * The month's budget at a glance — the five headline figures plus the per-pay-cycle breakdown.
 * Ported from the old Budget page so the Expenses hub carries the same numbers (Phase 5C).
 */
export function BudgetSummary({ plan }: { plan: MonthlyPlan }) {
  const cycles = (["first", "mid", "none"] as const).filter(
    (c) => plan.byCycle[c].income > 0 || plan.byCycle[c].outflow > 0,
  );

  return (
    <section className="mb-8" aria-label="This month's budget">
      <p className={labelClass}>// this month</p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Income" value={formatUsd(plan.income)} accentVar="--color-accent-emerald" />
        <StatCard label="Offerings" value={formatUsd(plan.offerings)} accentVar="--color-accent-purple" />
        <StatCard label="Expenses" value={formatUsd(plan.expenses)} accentVar="--color-accent-amber" />
        <StatCard label="Min. debt payments" value={formatUsd(plan.debtMinimums)} accentVar="--color-accent-red" />
        <StatCard
          label="Budget left"
          value={formatUsd(plan.leftover)}
          accentVar={plan.leftover < 0 ? "--color-accent-red" : "--color-accent-blue"}
        />
      </div>

      {cycles.length > 0 ? (
        <div className="mt-4">
          <p className={labelClass}>// by pay cycle</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cycles.map((c) => (
              <CycleColumn key={c} title={CYCLE_LABELS[c]} b={plan.byCycle[c]} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
