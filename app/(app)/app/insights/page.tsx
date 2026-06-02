import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { featureState } from "@/lib/flags/server";
import { ComingSoon } from "@/components/finance/ComingSoon";
import { RequireTier } from "@/components/entitlements/RequireTier";
import { StatCard } from "@/components/layout/StatCard";
import { SparkArea, BarList, UtilizationGauge, type BarItem } from "@/components/finance/charts";
import { DebtTypeIcon } from "@/components/finance/DebtTypeIcon";
import { debtDistribution, aprBuckets, totalUtilization, type InsightDebt } from "@/lib/finance/insights";
import { computePayoff, type PayoffDebtInput } from "@/lib/finance/payoff";
import { formatUsd } from "@/lib/finance/derive";
import { labelClass } from "@/components/finance/formStyles";
import type { Debt } from "@/lib/finance/types";

export const dynamic = "force-dynamic";

const ACCENTS = [
  "--color-accent-blue",
  "--color-accent-emerald",
  "--color-accent-amber",
  "--color-accent-purple",
  "--color-accent-red",
];

export default async function InsightsPage() {
  const { visible } = await featureState("insights");
  if (!visible) return <ComingSoon title="Insights" />;

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("debts")
    .select("id, name, type, balance, apr, min_payment, credit_limit")
    .is("archived_at", null);

  const rows = (data ?? []) as Pick<
    Debt,
    "id" | "name" | "type" | "balance" | "apr" | "min_payment" | "credit_limit"
  >[];
  const debts: InsightDebt[] = rows.map((d) => ({
    type: d.type,
    balance: Number(d.balance),
    apr: Number(d.apr),
    credit_limit: d.credit_limit === null ? null : Number(d.credit_limit),
  }));

  const totalBalance = debts.reduce((s, d) => s + d.balance, 0);
  const totalMin = rows.reduce((s, d) => s + Number(d.min_payment), 0);

  const dist = debtDistribution(debts);
  const distItems: BarItem[] = dist.map((s, i) => ({
    label: s.label,
    amount: s.total,
    pct: s.pct,
    accentVar: ACCENTS[i % ACCENTS.length],
    icon: <DebtTypeIcon type={s.type} className="size-3.5" />,
  }));
  const aprItems: BarItem[] = aprBuckets(debts).map((b, i) => ({
    label: b.label,
    amount: b.total,
    pct: totalBalance > 0 ? b.total / totalBalance : 0,
    accentVar: ACCENTS[i % ACCENTS.length],
  }));
  const util = totalUtilization(debts);

  // A representative payoff curve: avalanche at minimums + a 5%-of-balance push.
  const payoffInput: PayoffDebtInput[] = rows.map((d) => ({
    id: d.id,
    name: d.name,
    balance: Number(d.balance),
    apr: Number(d.apr),
    min_payment: Number(d.min_payment),
  }));
  const budget = Math.round(totalMin + Math.max(100, totalBalance * 0.05));
  const payoff = computePayoff(payoffInput, budget, "avalanche");
  const timeline = [totalBalance, ...payoff.schedule.map((m) => m.totalBalance)];
  const interestSeries = payoff.schedule.map((m) => m.totalInterest);

  if (debts.length === 0) {
    return (
      <div className="mx-auto max-w-5xl">
        <Header />
        <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-strong)] p-10 text-center">
          <p className="font-mono text-sm text-[var(--color-text-muted)]">
            // add some debts to see your distributions, utilization, and payoff curve
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Header />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total balance" value={formatUsd(totalBalance)} accentVar="--color-accent-red" />
        <StatCard
          label="Debt-free"
          value={payoff.feasible ? `${payoff.months} mo` : "—"}
          hint={payoff.feasible ? `at ${formatUsd(budget)}/mo` : "raise budget"}
          accentVar="--color-accent-emerald"
        />
        <StatCard
          label="Projected interest"
          value={payoff.feasible ? formatUsd(payoff.totalInterest) : "—"}
          accentVar="--color-accent-amber"
        />
      </div>

      <section className="mb-8 rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-6">
        <p className={labelClass}>// payoff curve (avalanche)</p>
        <div className="mt-4">
          <SparkArea values={timeline} accentVar="--color-accent-emerald" />
        </div>
      </section>

      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <section className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-6">
          <p className={labelClass}>// debt distribution</p>
          <div className="mt-4">
            <BarList items={distItems} ariaLabel="Debt distribution" />
          </div>
        </section>
        <section className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-6">
          <p className={labelClass}>// by APR</p>
          <div className="mt-4">
            <BarList items={aprItems} ariaLabel="APR distribution" />
          </div>
        </section>
      </div>

      {util !== null ? (
        <section className="mb-8 rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-6">
          <p className={labelClass}>// credit utilization</p>
          <div className="mt-4 max-w-sm">
            <UtilizationGauge pct={util} />
          </div>
        </section>
      ) : null}

      {/* Gate B: advanced charts are Pro-only — free users get the upsell. */}
      <section>
        <p className={labelClass}>// advanced</p>
        <div className="mt-3">
          <RequireTier tier="pro">
            <div className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-6">
              <p className="font-mono text-[11px] text-[var(--color-text-muted)]">
                Interest charged per month (declines as balances fall)
              </p>
              <div className="mt-4">
                <SparkArea values={interestSeries} accentVar="--color-accent-red" />
              </div>
            </div>
          </RequireTier>
        </div>
      </section>
    </div>
  );
}

function Header() {
  return (
    <header className="mb-8">
      <p className={labelClass}>// insights</p>
      <h1 className="mt-2 font-sans text-3xl font-medium text-[var(--color-text-primary)]">Insights</h1>
    </header>
  );
}
