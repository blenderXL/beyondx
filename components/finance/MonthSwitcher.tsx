"use client";

import { useRouter } from "next/navigation";
import { type MonthOption } from "@/lib/finance/history";
import { inputClass, labelClass } from "@/components/finance/formStyles";

/**
 * Month picker for the Expenses hub. The current month routes to /app/expenses (live, editable);
 * a past month routes to /app/expenses?month=YYYY-MM-01 (read-only history).
 */
export function MonthSwitcher({
  months,
  selected,
  currentMonth,
}: {
  months: MonthOption[];
  selected: string;
  currentMonth: string;
}) {
  const router = useRouter();
  return (
    <label className="block">
      <span className={labelClass}>// month</span>
      <select
        aria-label="Month"
        value={selected}
        onChange={(e) => {
          const v = e.target.value;
          router.push(v === currentMonth ? "/app/expenses" : `/app/expenses?month=${v}`);
        }}
        className={`${inputClass} mt-1 h-9 !w-auto max-w-[14rem]`}
      >
        {months.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
            {m.value === currentMonth ? " · this month" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
