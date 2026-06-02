"use client";

import { useMemo, useState } from "react";
import { StatCard } from "@/components/layout/StatCard";
import { computePayoff, orderDebts, type PayoffDebtInput, type PayoffMethod } from "@/lib/finance/payoff";
import { formatUsd, formatPercent } from "@/lib/finance/derive";
import { inputClass, labelClass } from "@/components/finance/formStyles";
import { DebtTypeIcon } from "@/components/finance/DebtTypeIcon";

const METHODS: { value: PayoffMethod; label: string; blurb: string }[] = [
  { value: "avalanche", label: "Avalanche", blurb: "Highest APR first — least interest paid." },
  { value: "snowball", label: "Snowball", blurb: "Smallest balance first — fastest wins." },
  { value: "custom", label: "Custom order", blurb: "Your chosen payoff order." },
];

function monthsToLabel(months: number): string {
  if (months <= 0) return "—";
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + months, 1);
  const date = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  const yrs = Math.floor(months / 12);
  const rem = months % 12;
  const human = yrs > 0 ? `${yrs}y ${rem}m` : `${rem}m`;
  return `${human} · ${date}`;
}

export function PlansClient({ debts }: { debts: PayoffDebtInput[] }) {
  const totalMin = useMemo(() => debts.reduce((s, d) => s + d.min_payment, 0), [debts]);
  const totalBalance = useMemo(() => debts.reduce((s, d) => s + d.balance, 0), [debts]);
  const [method, setMethod] = useState<PayoffMethod>("avalanche");
  // Default budget: minimums + 10% of balance-ish, but at least minimums + $100.
  const [budget, setBudget] = useState<number>(Math.max(Math.round(totalMin) + 100, Math.round(totalMin)));

  const result = useMemo(() => computePayoff(debts, budget, method), [debts, budget, method]);
  const ordered = useMemo(() => orderDebts(debts, method), [debts, method]);

  if (debts.length === 0) {
    return (
      <div className="mx-auto max-w-5xl">
        <Header />
        <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-strong)] p-10 text-center">
          <p className="font-mono text-sm text-[var(--color-text-muted)]">
            // add some debts first — the payoff plan needs balances to work with
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Header />

      <div className="mb-8 grid gap-4 rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-6 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Method</span>
          <select
            aria-label="Method"
            value={method}
            onChange={(e) => setMethod(e.target.value as PayoffMethod)}
            className={inputClass}
          >
            {METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <span className="mt-1 block font-mono text-[10px] text-[var(--color-text-muted)]">
            {METHODS.find((m) => m.value === method)?.blurb}
          </span>
        </label>
        <label className="block">
          <span className={labelClass}>Monthly budget</span>
          <input
            type="number"
            aria-label="Monthly budget"
            min={0}
            step={50}
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value) || 0)}
            className={inputClass}
          />
          <span className="mt-1 block font-mono text-[10px] text-[var(--color-text-muted)]">
            minimums total {formatUsd(totalMin)}
          </span>
        </label>
      </div>

      {!result.feasible ? (
        <div
          role="alert"
          className="mb-8 rounded-[var(--radius-card)] border border-[var(--color-accent-red)] bg-[var(--color-surface)] p-5"
        >
          <p className="font-mono text-sm text-[var(--color-accent-red)]">
            // budget too low — it doesn&apos;t cover the minimums or only services interest. Raise the
            monthly budget above {formatUsd(totalMin)}.
          </p>
        </div>
      ) : (
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <StatCard label="Debt-free" value={monthsToLabel(result.months)} accentVar="--color-accent-emerald" />
          <StatCard label="Total interest" value={formatUsd(result.totalInterest)} accentVar="--color-accent-red" />
          <StatCard label="Total balance" value={formatUsd(totalBalance)} accentVar="--color-accent-blue" />
        </div>
      )}

      <section>
        <p className={labelClass}>// payoff order</p>
        <ul aria-label="Payoff order" className="mt-3 grid gap-3">
          {ordered.map((d, i) => {
            const paidMonth = result.perDebtPayoffMonth[d.id];
            return (
              <li
                key={d.id}
                className="flex items-center justify-between gap-4 rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-5 py-4"
              >
                <div className="flex items-center gap-4">
                  <span className="font-mono text-sm text-[var(--color-text-muted)] tabular-nums">#{i + 1}</span>
                  {d.type ? (
                    <span className="shrink-0 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] p-2 text-[var(--color-text-secondary)]">
                      <DebtTypeIcon type={d.type} className="size-4" />
                    </span>
                  ) : null}
                  <div>
                    <p className="font-sans text-sm font-medium text-[var(--color-text-primary)]">{d.name}</p>
                    <p className="font-mono text-[11px] text-[var(--color-text-muted)]">
                      {formatUsd(d.balance)} · {formatPercent(d.apr)} APR · min {formatUsd(d.min_payment)}
                    </p>
                  </div>
                </div>
                <p className="font-mono text-[11px] text-[var(--color-text-secondary)]">
                  {result.feasible && paidMonth ? `paid off ${monthsToLabel(paidMonth)}` : "—"}
                </p>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function Header() {
  return (
    <header className="mb-8">
      <p className={labelClass}>// plans</p>
      <h1 className="mt-2 font-sans text-3xl font-medium text-[var(--color-text-primary)]">Payoff plan</h1>
    </header>
  );
}
