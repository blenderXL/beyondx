"use client";

import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { StatCard } from "@/components/layout/StatCard";
import { computePayoff, orderDebts, type PayoffDebtInput, type PayoffMethod } from "@/lib/finance/payoff";
import { buildAmortizationCsv } from "@/lib/finance/amortizationCsv";
import { formatUsd, formatPercent } from "@/lib/finance/derive";
import { inputClass, labelClass, ghostButtonClass } from "@/components/finance/formStyles";
import { DebtTypeIcon } from "@/components/finance/DebtTypeIcon";
import { FieldHint } from "@/components/finance/FieldHint";
import { PLAN_HINTS } from "@/lib/finance/fieldHints";

const METHODS: { value: PayoffMethod; label: string; blurb: string }[] = [
  { value: "avalanche", label: "Avalanche", blurb: "Highest APR first — least interest paid." },
  { value: "snowball", label: "Snowball", blurb: "Smallest balance first — fastest wins." },
  { value: "custom", label: "Custom order", blurb: "Your chosen payoff order." },
];

/** localStorage keys for the user's last payoff selections. */
const METHOD_KEY = "nzx.plans.method";
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

export function PlansClient({ debts }: { debts: PayoffDebtInput[] }) {
  const totalMin = useMemo(() => debts.reduce((s, d) => s + d.min_payment, 0), [debts]);
  const totalBalance = useMemo(() => debts.reduce((s, d) => s + d.balance, 0), [debts]);
  const [method, setMethod] = useState<PayoffMethod>("avalanche");
  // Default budget: minimums + 10% of balance-ish, but at least minimums + $100.
  const [budget, setBudget] = useState<number>(Math.max(Math.round(totalMin) + 100, Math.round(totalMin)));

  // Persist the user's last method + budget across reloads (client-only, no backend).
  // Read once on mount AFTER first render so SSR/CSR markup matches (no hydration flash of
  // stored values); the `hydrated` gate stops the save effect from clobbering storage with
  // defaults before the read runs. Values are validated before use (ignore tampered input).
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try {
      const m = localStorage.getItem(METHOD_KEY);
      if (m && METHODS.some((x) => x.value === m)) setMethod(m as PayoffMethod);
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
      localStorage.setItem(METHOD_KEY, method);
      localStorage.setItem(BUDGET_KEY, String(budget));
    } catch {
      /* ignore quota / availability errors */
    }
  }, [hydrated, method, budget]);

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
            <table aria-label="Month-by-month payoff schedule" className="w-full border-collapse font-mono text-[11px]">
              <thead className="sticky top-0 z-10 bg-[var(--color-elevated)] text-[var(--color-text-muted)]">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-normal">Month</th>
                  {debts.map((d) => (
                    <th key={d.id} scope="col" className="whitespace-nowrap px-3 py-2 text-right font-normal">
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
