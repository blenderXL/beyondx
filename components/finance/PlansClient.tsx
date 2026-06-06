"use client";

import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import {
  computePayoff,
  orderDebts,
  PAYOFF_METHODS,
  type PayoffDebtInput,
  type PayoffMethod,
} from "@/lib/finance/payoff";
import { bucketDistribution, type InsightDebt } from "@/lib/finance/insights";
import { PayoffChart } from "@/components/finance/charts";
import { setPayoffMethod, setPayoffBudget } from "@/app/(app)/actions";
import { buildAmortizationCsv } from "@/lib/finance/amortizationCsv";
import { formatUsd, formatPercent } from "@/lib/finance/derive";
import { inputClass, labelClass, ghostButtonClass } from "@/components/finance/formStyles";
import { DebtTypeIcon } from "@/components/finance/DebtTypeIcon";
import { FieldHint } from "@/components/finance/FieldHint";
import { PLAN_HINTS } from "@/lib/finance/fieldHints";

/** localStorage key for the user's last monthly budget (method is persisted on the profile). */
const BUDGET_KEY = "nzx.plans.budget";

/** APR-exposure bands for the segmented bar: low (<7%), mid (7–20%), high (20%+). */
const APR_BANDS = [
  { key: "LOW", accent: "--color-accent-emerald", test: (a: number) => a < 7 },
  { key: "MID", accent: "--color-accent-amber", test: (a: number) => a >= 7 && a < 20 },
  { key: "HIGH", accent: "--color-accent-red", test: (a: number) => a >= 20 },
] as const;

/** Calendar label for schedule month index N (1 = the current month). */
function monthLabel(index: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + (index - 1), 1);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function PlansClient({
  debts,
  insightDebts,
  initialMethod,
  initialBudget,
}: {
  debts: PayoffDebtInput[];
  /** Same debts shaped for distribution math (carries credit_limit for utilization). */
  insightDebts: InsightDebt[];
  /** The method persisted on the profile (server-resolved; defaults to avalanche). */
  initialMethod: PayoffMethod;
  /** The budget persisted on the profile; null pre-migration / before the user sets one. */
  initialBudget: number | null;
}) {
  const totalMin = useMemo(() => debts.reduce((s, d) => s + d.min_payment, 0), [debts]);
  const totalBalance = useMemo(() => debts.reduce((s, d) => s + d.balance, 0), [debts]);
  const defaultBudget = Math.max(Math.round(totalMin) + 100, Math.round(totalMin));
  const [method, setMethod] = useState<PayoffMethod>(initialMethod);
  // Method + budget are both persisted on the profile so the Dashboard projects the same
  // payoff date. Initialize the budget from the profile (no hydration flash); pre-migration
  // (initialBudget null) fall back to the per-browser localStorage cache.
  const [budget, setBudget] = useState<number>(initialBudget ?? defaultBudget);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (initialBudget == null) {
      try {
        const b = localStorage.getItem(BUDGET_KEY);
        if (b !== null) {
          const n = Number(b);
          if (Number.isFinite(n) && n >= 0) setBudget(n);
        }
      } catch {
        /* storage unavailable (private mode / disabled) — fall back to defaults */
      }
    }
    setHydrated(true);
  }, [initialBudget]);
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
  const methodLabel = PAYOFF_METHODS.find((m) => m.value === method)!.label.toLowerCase();

  // Payoff curve in the chosen method/budget; distributions are budget-independent.
  const timeline = useMemo(
    () => [totalBalance, ...result.schedule.map((m) => m.totalBalance)],
    [totalBalance, result.schedule],
  );
  // Minimums-only baseline curve (no extra payments) for the chart comparison.
  const baselineResult = useMemo(
    () => computePayoff(debts, Math.round(totalMin), method),
    [debts, totalMin, method],
  );
  const baseline = useMemo(() => {
    const raw = [totalBalance, ...baselineResult.schedule.map((m) => m.totalBalance)];
    // If minimums-only stalls early (never pays off), extend it flat so the comparison line
    // spans the same horizon as the strategy curve instead of vanishing.
    const span = timeline.length;
    while (raw.length < span) raw.push(raw[raw.length - 1] ?? totalBalance);
    return raw;
  }, [totalBalance, baselineResult.schedule, timeline.length]);

  // Asset-alloc segments (by bucket) for the single segmented bar + legend.
  const buckets = useMemo(() => bucketDistribution(insightDebts), [insightDebts]);
  // APR-exposure as low/mid/high bands (% of total balance).
  const aprBands = useMemo(() => {
    const total = insightDebts.reduce((s, d) => (d.balance > 0 ? s + d.balance : s), 0);
    return APR_BANDS.map((b) => {
      const sum = insightDebts.reduce((s, d) => (d.balance > 0 && b.test(d.apr) ? s + d.balance : s), 0);
      return { key: b.key, accent: b.accent, pct: total > 0 ? (sum / total) * 100 : 0 };
    });
  }, [insightDebts]);

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
      <div className="mx-auto max-w-6xl">
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
    <div className="mx-auto max-w-6xl">
      <Header />

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Center: projections */}
        <div className="min-w-0 flex-1 space-y-6">
          <section className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-6">
            <p className={labelClass}>// payoff curve ({methodLabel})</p>
            <div className="mt-4">
              {result.feasible ? (
                <PayoffChart strategy={timeline} baseline={baseline} strategyLabel={methodLabel} />
              ) : (
                <p className="font-mono text-[11px] text-[var(--color-text-muted)]">
                  // raise the budget above {formatUsd(totalMin)} to project a payoff curve
                </p>
              )}
            </div>
          </section>

          {!result.feasible ? (
            <div
              role="alert"
              className="rounded-[var(--radius-card)] border border-[var(--color-accent-red)] bg-[var(--color-surface)] p-5"
            >
              <p className="font-mono text-sm text-[var(--color-accent-red)]">
                // budget too low — it doesn&apos;t cover the minimums or only services interest. Raise the
                monthly budget above {formatUsd(totalMin)}.
              </p>
            </div>
          ) : result.schedule.length > 0 ? (
            <section>
              <div className="flex items-end justify-between gap-4">
                <p className={labelClass}>// month-by-month</p>
                <button type="button" onClick={downloadCsv} className={ghostButtonClass} aria-label="Export CSV">
                  <Download className="mr-2 size-3.5" aria-hidden />
                  Export CSV
                </button>
              </div>
              <div className="mt-3 max-h-[32rem] overflow-auto rounded-[var(--radius-card)] border border-[var(--color-border-subtle)]">
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

        {/* Right: strategy + projections summary */}
        <aside className="w-full shrink-0 space-y-6 lg:sticky lg:top-6 lg:h-fit lg:w-[320px]">
          {/* Strategy setup */}
          <section className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-4">
            <p className={labelClass}>// strategy setup</p>
            <label className="mt-4 block">
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
            <label className="mt-4 block">
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
                onBlur={() => void setPayoffBudget(budget)}
                className={inputClass}
              />
              <span className="mt-1 block font-mono text-[10px] text-[var(--color-text-muted)]">
                minimums total {formatUsd(totalMin)}
              </span>
            </label>
          </section>

          {/* Macro stats */}
          <div className="grid grid-cols-3 divide-x divide-[var(--color-border-subtle)] overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)]">
            <MacroStat label="Debt-free" value={result.feasible ? humanMonths(result.months) : "—"} sub={result.feasible ? monthOnly(result.months) : "raise budget"} />
            <MacroStat label="Balance" value={compactUsd(totalBalance)} />
            <MacroStat label="Interest" value={result.feasible ? compactUsd(result.totalInterest) : "—"} accent="--color-accent-amber" />
          </div>

          {/* Distributions — single segmented bars + legends (stitch reference) */}
          <section className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className={labelClass}>// asset alloc</p>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {buckets.map((b) => (
                  <span key={b.bucket} className="flex items-center gap-1 font-mono text-[8px] text-[var(--color-text-muted)]">
                    <span className="size-1.5 rounded-full" style={{ background: `var(${b.accentVar})` }} aria-hidden />
                    {b.label}
                  </span>
                ))}
              </div>
            </div>
            <div aria-label="Debt distribution" className="flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-elevated)]">
              {buckets.map((b) => (
                <div key={b.bucket} className="h-full" style={{ width: `${b.pct * 100}%`, background: `var(${b.accentVar})` }} />
              ))}
            </div>

            <p className={`${labelClass} mt-6`}>// apr exposure</p>
            <div aria-label="APR distribution" className="mt-3 flex h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-elevated)]">
              {aprBands.map((b) => (
                <div key={b.key} className="h-full" style={{ width: `${b.pct}%`, background: `var(${b.accent})` }} />
              ))}
            </div>
            <div className="mt-1.5 flex justify-between font-mono text-[8px] text-[var(--color-text-muted)]">
              {aprBands.map((b) => (
                <span key={b.key}>
                  {b.key} ({Math.round(b.pct)}%)
                </span>
              ))}
            </div>
          </section>

          {/* Payoff order */}
          <section>
            <p className={labelClass}>// payoff order</p>
            <ul aria-label="Payoff order" className="mt-3 space-y-2">
              {ordered.map((d, i) => {
                const paidMonth = result.perDebtPayoffMonth[d.id];
                const isNext = i === 0; // the debt the strategy clears first
                return (
                  <li
                    key={d.id}
                    className="relative flex items-center gap-3 overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] py-3 pr-3 pl-4"
                  >
                    {isNext ? (
                      <span aria-hidden className="absolute left-0 top-0 h-full w-1 bg-[var(--color-accent-emerald)]" />
                    ) : null}
                    <span className="w-4 shrink-0 font-mono text-[11px] text-[var(--color-text-muted)] tabular-nums">
                      #{i + 1}
                    </span>
                    {d.type ? (
                      <span className="shrink-0 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] p-1.5 text-[var(--color-text-secondary)]">
                        <DebtTypeIcon type={d.type} className="size-4" />
                      </span>
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-sans text-xs font-medium text-[var(--color-text-primary)]">{d.name}</p>
                      <p className="truncate font-mono text-[10px] text-[var(--color-text-muted)]">
                        {formatUsd(d.balance)} · {formatPercent(d.apr)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className="font-mono text-[10px]"
                        style={{ color: isNext ? "var(--color-accent-emerald)" : "var(--color-text-secondary)" }}
                      >
                        {result.feasible && paidMonth ? monthOnly(paidMonth) : "—"}
                      </p>
                      {isNext && result.feasible && paidMonth ? (
                        <p className="font-mono text-[8px] text-[var(--color-text-muted)]">in {paidMonth}m</p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

/** "10y 2m" / "7m" — the human duration without a calendar date. */
function humanMonths(months: number): string {
  if (months <= 0) return "—";
  const yrs = Math.floor(months / 12);
  const rem = months % 12;
  return yrs > 0 ? `${yrs}y ${rem}m` : `${rem}m`;
}

/** "Aug 2036" for a count of months from now. */
function monthOnly(months: number): string {
  if (months <= 0) return "—";
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + months, 1);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/** Compact money for tight sidebar stats: $765.4k / $1.2M / $940. */
function compactUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return formatUsd(n);
}

function MacroStat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="p-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{label}</p>
      <p
        className="mt-1 truncate font-sans text-sm font-medium tabular-nums"
        style={{ color: accent ? `var(${accent})` : "var(--color-text-primary)" }}
        title={value}
      >
        {value}
      </p>
      {sub ? <p className="truncate font-mono text-[9px] text-[var(--color-text-muted)]">{sub}</p> : null}
    </div>
  );
}

function Header() {
  return (
    <header className="mb-8">
      <p className={labelClass}>// debt payoff planner</p>
      <h1 className="mt-2 font-sans text-3xl font-medium text-[var(--color-text-primary)]">
        Strategy &amp; Projections
      </h1>
    </header>
  );
}
