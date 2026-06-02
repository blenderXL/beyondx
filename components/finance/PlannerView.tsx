import { StatCard } from "@/components/layout/StatCard";
import { formatUsd } from "@/lib/finance/derive";
import type { MonthlyPlan, CycleBreakdown, Cycle } from "@/lib/finance/planner";
import { PlannerBills, type PlannerBill } from "@/components/finance/PlannerBills";
import { labelClass } from "@/components/finance/formStyles";

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
    ["Debt minimums", -b.minimums],
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

export function PlannerView({
  plan,
  bills,
  billingMonth,
}: {
  plan: MonthlyPlan;
  bills: PlannerBill[];
  billingMonth: string;
}) {
  const cycles = (["first", "mid", "none"] as const).filter(
    (c) => plan.byCycle[c].income > 0 || plan.byCycle[c].outflow > 0,
  );

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8">
        <p className={labelClass}>// planner</p>
        <h1 className="mt-2 font-sans text-3xl font-medium text-[var(--color-text-primary)]">This month</h1>
      </header>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Income" value={formatUsd(plan.income)} accentVar="--color-accent-emerald" />
        <StatCard label="Offerings" value={formatUsd(plan.offerings)} accentVar="--color-accent-purple" />
        <StatCard label="Expenses" value={formatUsd(plan.expenses)} accentVar="--color-accent-amber" />
        <StatCard label="Debt minimums" value={formatUsd(plan.debtMinimums)} accentVar="--color-accent-red" />
        <StatCard
          label="Budget left"
          value={formatUsd(plan.leftover)}
          accentVar={plan.leftover < 0 ? "--color-accent-red" : "--color-accent-blue"}
        />
      </div>

      {cycles.length > 0 ? (
        <section className="mb-8">
          <p className={labelClass}>// by pay cycle</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cycles.map((c) => (
              <CycleColumn key={c} title={CYCLE_LABELS[c]} b={plan.byCycle[c]} />
            ))}
          </div>
        </section>
      ) : null}

      {plan.byGroup.length > 0 ? (
        <section>
          <p className={labelClass}>// rollups</p>
          <ul
            aria-label="Rollups"
            className="mt-3 divide-y divide-[var(--color-border-subtle)] rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)]"
          >
            {plan.byGroup.map((g) => (
              <li key={g.group} className="flex items-center justify-between gap-4 px-5 py-3">
                <span className="font-mono text-[12px] text-[var(--color-text-secondary)]">{g.group}</span>
                <span className="font-mono text-[12px] tabular-nums text-[var(--color-text-primary)]">
                  {formatUsd(g.amount)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <PlannerBills bills={bills} billingMonth={billingMonth} />
    </div>
  );
}
