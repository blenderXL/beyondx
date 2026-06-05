"use client";

import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { StatCard } from "@/components/layout/StatCard";
import {
  computePayoff,
  orderDebts,
  PAYOFF_METHODS,
  type PayoffDebtInput,
  type PayoffMethod,
} from "@/lib/finance/payoff";
import { setPayoffMethod } from "@/app/(app)/actions";
import { buildAmortizationCsv } from "@/lib/finance/amortizationCsv";
import { formatUsd, formatPercent } from "@/lib/finance/derive";
import { inputClass, labelClass, ghostButtonClass } from "@/components/finance/formStyles";
import { DebtTypeIcon } from "@/components/finance/DebtTypeIcon";
import { FieldHint } from "@/components/finance/FieldHint";
import { PLAN_HINTS } from "@/lib/finance/fieldHints";

/** localStorage key for the user's last monthly budget (method is persisted on the profile). */
const BUDGET_KEY = "nzx.plans.budget";

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

/** Calendar label for schedule month index N (1 = the current month). */
function monthLabel(index: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + (index - 1), 1);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function PlansClient({
  debts,
  initialMethod,
}: {
  debts: PayoffDebtInput[];
  /** The method persisted on the profile (server-resolved; defaults to avalanche). */
  initialMethod: PayoffMethod;
}) {
  const totalMin = useMemo(() => debts.reduce((s, d) => s + d.min_payment, 0), [debts]);
  const totalBalance = useMemo(() => debts.reduce((s, d) => s + d.balance, 0), [debts]);
  const [method, setMethod] = useState<PayoffMethod>(initialMethod);
  // Default budget: minimums + 10% of balance-ish, but at least minimums + $100.
  const [budget, setBudget] = useState<number>(Math.max(Math.round(totalMin) + 100, Math.round(totalMin)));

  // The method is persisted on the profile (shared with Insights); only the budget stays
  // client-only. Read it once AFTER first render so SSR/CSR markup matches (no hydration
  // flash); the `hydrated` gate stops the save effect from clobbering storage with the
  // default before the read runs.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try {
      const b = localStorage.getItem(BUDGET_KEY);
      if (b !== null) {
        const n = Number(b);
        if (Number.isFinite(n) && n >= 0) setBudget(n);
      }
    } catch {
      /* storage unavailable (private mode / disabled) — fall back to defaults */
    }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(BUDGET_KEY, String(budget));
    } catch {
      /* ignore quota / availability errors */
    }
  }, [hydrated, budget]);

  /** Update local state immediately, then persist the choice to the profile. */
  function changeMethod(next: PayoffMethod) {
    setMethod(next);
    void setPayoffMethod(next);
  }

  const result = useMemo(() => computePayoff(debts, budget, method), [debts, budget, method]);
  const ordered = useMemo(() => orderDebts(debts, method), [debts, method]);
  const monthLabels = useMemo(() => result.schedule.map((m) => monthLabel(m.month)), [result.schedule]);

  function downloadCsv() {
    const csv = buildAmortizationCsv(
      debts.map((d) => ({ id: d.id, name: d.name })),
      result.schedule,
      monthLabels,
    );
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `payoff-${method}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

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
          <span className={labelClass}>
            Method
            <FieldHint text={PLAN_HINTS.method} label="method" />
          </span>
          <select
            aria-label="Method"
            value={method}
            onChange={(e) => changeMethod(e.target.value as PayoffMethod)}
            className={inputClass}
          >
            {PAYOFF_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <span className="mt-1 block font-mono text-[10px] text-[var(--color-text-muted)]">
            {PAYOFF_METHODS.find((m) => m.value === method)?.blurb}
          </span>
        </label>
        <label className="block">
          <span className={labelClass}>
            Monthly budget
            <FieldHint text={PLAN_HINTS.budget} label="monthly budget" />
          </span>
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

      {result.feasible && result.schedule.length > 0 ? (
        <section className="mt-8">
          <div className="flex items-end justify-between gap-4">
            <p className={labelClass}>// month-by-month</p>
            <button type="button" onClick={downloadCsv} className={ghostButtonClass} aria-label="Export CSV">
              <Download className="mr-2 size-3.5" aria-hidden />
              Export CSV
            </button>
          </div>
          <div className="mt-3 max-h-[28rem] overflow-auto rounded-[var(--radius-card)] border border-[var(--color-border-subtle)]">
            {/* table-fixed + a defined table width makes every column an equal share, regardless
                of value/header length (long headers truncate). minWidth scales with the column
                count so the table fills the panel and scrolls sideways once there are many debts. */}
            <table
              aria-label="Month-by-month payoff schedule"
              className="w-full table-fixed border-collapse font-mono text-[11px]"
              style={{ minWidth: `${(debts.length + 4) * 7}rem` }}
            >
              <thead className="sticky top-0 z-10 bg-[var(--color-elevated)] text-[var(--color-text-muted)]">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-normal">Month</th>
                  {debts.map((d) => (
                    <th key={d.id} scope="col" title={d.name} className="truncate px-3 py-2 text-right font-normal">
                      {d.name}
                    </th>
                  ))}
                  <th scope="col" className="px-3 py-2 text-right font-normal">Interest</th>
                  <th scope="col" className="px-3 py-2 text-right font-normal">Balance</th>
                  <th scope="col" className="px-3 py-2 text-right font-normal">Total paid</th>
                </tr>
              </thead>
              <tbody>
                {result.schedule.map((m, i) => (
                  <tr key={m.month} className="border-t border-[var(--color-border-subtle)]">
                    <td className="whitespace-nowrap px-3 py-1.5 text-left text-[var(--color-text-secondary)]">
                      {monthLabels[i]}
                    </td>
                    {debts.map((d) => (
                      <td key={d.id} className="px-3 py-1.5 text-right tabular-nums text-[var(--color-text-secondary)]">
                        {formatUsd(m.byDebt[d.id]?.payment ?? 0)}
                      </td>
                    ))}
                    <td className="px-3 py-1.5 text-right tabular-nums text-[var(--color-text-secondary)]">
                      {formatUsd(m.totalInterest)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-[var(--color-text-primary)]">
                      {formatUsd(m.totalBalance)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-[var(--color-text-secondary)]">
                      {formatUsd(m.totalPaid)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Header() {
  return (
    <header className="mb-8">
      <p className={labelClass}>// payoff plan</p>
      <h1 className="mt-2 font-sans text-3xl font-medium text-[var(--color-text-primary)]">Payoff plan</h1>
    </header>
  );
}
