import { StatCard } from "@/components/layout/StatCard";
import { MonthSwitcher } from "@/components/finance/MonthSwitcher";
import { summarizeHistory, type HistoryItem, type MonthOption } from "@/lib/finance/history";
import { formatUsd } from "@/lib/finance/derive";
import { labelClass } from "@/components/finance/formStyles";

/**
 * Read-only view of a past month: what you actually paid + contributed that month, from the
 * recorded transactions. The current month is the editable hub (ExpensesClient) instead.
 */
export function ExpensesHistory({
  monthLabel,
  months,
  selected,
  currentMonth,
  items,
}: {
  monthLabel: string;
  months: MonthOption[];
  selected: string;
  currentMonth: string;
  items: HistoryItem[];
}) {
  const { total, count } = summarizeHistory(items);

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={labelClass}>// expenses · history</p>
          <h1 className="mt-2 font-sans text-3xl font-medium text-[var(--color-text-primary)]">{monthLabel}</h1>
        </div>
        <MonthSwitcher months={months} selected={selected} currentMonth={currentMonth} />
      </header>

      <p className="mb-6 font-mono text-[11px] text-[var(--color-text-muted)]">
        // a read-only record of what you checked off this month · switch to this month to make changes
      </p>

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <StatCard label="Paid this month" value={formatUsd(total)} accentVar="--color-accent-emerald" />
        <StatCard label="Items" value={String(count)} accentVar="--color-accent-blue" />
      </div>

      {items.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-strong)] p-10 text-center">
          <p className="font-mono text-sm text-[var(--color-text-muted)]">// nothing was checked off in {monthLabel}</p>
        </div>
      ) : (
        <ul
          aria-label="Paid items"
          className="divide-y divide-[var(--color-border-subtle)] rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)]"
        >
          {items.map((it) => (
            <li key={it.id} className="flex items-center justify-between gap-4 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate font-sans text-sm text-[var(--color-text-primary)]">{it.name}</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                  {it.kind === "contribution" ? "Savings" : "Payment"}
                </p>
              </div>
              <p
                className="shrink-0 font-mono text-sm tabular-nums"
                style={{ color: it.kind === "contribution" ? "var(--color-accent-blue)" : "var(--color-accent-emerald)" }}
              >
                {it.kind === "contribution" ? "+" : "−"}
                {formatUsd(it.amount)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
