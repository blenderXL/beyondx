"use client";

import { useMemo } from "react";
import { formatUsd } from "@/lib/finance/derive";

/** One bill placed on the calendar by its pay day (1–31). */
export interface CalendarItem {
  name: string;
  day: number;
  amount: number;
  paid: boolean;
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"] as const;

/** Ordinal day-of-month: 1 → "1st". */
function ordinal(day: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = day % 100;
  return `${day}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/**
 * Month calendar of this month's bills by pay day, with the day total on each cell. An unpaid
 * bill whose day has already passed (or is today) reads red — "due or past due". Savings bills
 * carry no pay day, so this covers expenses + debt payments.
 */
export function PayCalendar({ items, billingMonth }: { items: CalendarItem[]; billingMonth: string }) {
  const parts = billingMonth.split("-").map(Number);
  const y = parts[0] ?? 1970;
  const m = parts[1] ?? 1; // 1–12
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();

  // "Today" only bites when we're viewing the current month.
  const now = new Date();
  const isCurrentMonth = now.getFullYear() === y && now.getMonth() === m - 1;
  const today = isCurrentMonth ? now.getDate() : 0;
  const monthLabel = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const byDay = useMemo(() => {
    const map = new Map<number, CalendarItem[]>();
    for (const it of items) {
      const arr = map.get(it.day) ?? [];
      arr.push(it);
      map.set(it.day, arr);
    }
    return map;
  }, [items]);

  const overdue = useMemo(
    () => items.filter((it) => !it.paid && it.day <= today && today > 0).sort((a, b) => a.day - b.day),
    [items, today],
  );

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
            // pay calendar
          </p>
          <h2 className="mt-1 font-sans text-xl font-medium text-[var(--color-text-primary)]">{monthLabel}</h2>
        </div>
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-accent-red)]">
          <span className="size-2 rounded-full bg-[var(--color-accent-red)]" aria-hidden /> due / past due
        </span>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w, i) => (
          <div
            key={i}
            className="pb-1 text-center font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]"
          >
            {w}
          </div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={`b-${i}`} />;
          const dayItems = byDay.get(d) ?? [];
          const total = dayItems.reduce((s, it) => s + it.amount, 0);
          const hasUnpaidDue = dayItems.some((it) => !it.paid) && d <= today && today > 0;
          const isToday = d === today;
          return (
            <div
              key={d}
              title={dayItems.map((it) => `${it.name}: ${formatUsd(it.amount)}`).join("\n") || undefined}
              className={`flex min-h-14 flex-col rounded-md border p-1.5 ${
                isToday
                  ? "border-[var(--color-text-primary)]"
                  : "border-[var(--color-border-subtle)]"
              } ${hasUnpaidDue ? "bg-[color-mix(in_oklab,var(--color-accent-red),transparent_90%)]" : ""}`}
            >
              <span
                className={`font-mono text-[10px] tabular-nums ${
                  isToday ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)]"
                }`}
              >
                {d}
              </span>
              {dayItems.length > 0 ? (
                <span
                  className={`mt-auto text-right font-mono text-[10px] tabular-nums ${
                    hasUnpaidDue ? "text-[var(--color-accent-red)]" : "text-[var(--color-text-secondary)]"
                  }`}
                >
                  {formatUsd(total)}
                  {dayItems.length > 1 ? (
                    <span className="ml-1 text-[var(--color-text-muted)]">·{dayItems.length}</span>
                  ) : null}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      {overdue.length > 0 ? (
        <div className="mt-5 border-t border-[var(--color-border-subtle)] pt-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-accent-red)]">
            // due / past due
          </p>
          <ul className="mt-2 space-y-1.5">
            {overdue.map((it, i) => (
              <li key={`${it.name}-${i}`} className="flex items-center justify-between gap-3 font-mono text-[11px]">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="text-[var(--color-text-muted)]">{ordinal(it.day)}</span>
                  <span className="truncate text-[var(--color-text-primary)]">{it.name}</span>
                </span>
                <span className="shrink-0 tabular-nums text-[var(--color-accent-red)]">{formatUsd(it.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : items.length === 0 ? (
        <p className="mt-4 font-mono text-[11px] text-[var(--color-text-muted)]">
          // no dated bills this month — add a pay day to an expense or debt
        </p>
      ) : null}
    </div>
  );
}
