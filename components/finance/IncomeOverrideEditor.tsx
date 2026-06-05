"use client";

import { useActionState } from "react";
import { setIncomeOverride } from "@/app/(app)/actions";
import { INITIAL_FINANCE_STATE } from "@/lib/finance/actionState";
import { formatUsd } from "@/lib/finance/derive";
import { INCOME_CADENCE_LABELS, type IncomeCadence } from "@/lib/finance/types";
import { inputClass, labelClass, primaryButtonClass, errorClass } from "@/components/finance/formStyles";

export interface VariableIncome {
  id: string;
  source: string;
  base: number;
  cadence: IncomeCadence;
  override: number | null;
}

function OverrideRow({ income, billingMonth }: { income: VariableIncome; billingMonth: string }) {
  const [state, formAction, pending] = useActionState(setIncomeOverride, INITIAL_FINANCE_STATE);

  return (
    <li className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-sans text-base font-medium text-[var(--color-text-primary)]">{income.source}</p>
        <p className="font-mono text-[11px] tracking-[0.18em] text-[var(--color-text-muted)] uppercase">
          base {formatUsd(income.base)} · {INCOME_CADENCE_LABELS[income.cadence]}
        </p>
      </div>

      <form action={formAction} className="mt-4 flex flex-wrap items-end gap-3">
        <input type="hidden" name="income_id" value={income.id} />
        <input type="hidden" name="billing_month" value={billingMonth} />
        <label className="block min-w-[8rem] flex-1">
          <span className={labelClass}>This month&apos;s actual</span>
          <input
            type="text"
            inputMode="decimal"
            name="amount"
            aria-label={`This month's actual for ${income.source}`}
            required
            defaultValue={income.override ?? ""}
            placeholder={String(income.base)}
            className={inputClass}
          />
        </label>
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? "Saving…" : "Set"}
        </button>
      </form>

      <p className="mt-2 font-mono text-[10px] text-[var(--color-text-muted)]">
        {income.override != null
          ? `// using ${formatUsd(income.override)} this month`
          : "// using the base amount this month"}
      </p>
      {state.error ? (
        <p role="alert" className={`mt-2 ${errorClass}`}>
          // {state.error}
        </p>
      ) : null}
    </li>
  );
}

/** Inline editor for variable income sources' this-month actuals, shown on the Budget page. */
export function IncomeOverrideEditor({
  incomes,
  billingMonth,
}: {
  incomes: VariableIncome[];
  billingMonth: string;
}) {
  if (incomes.length === 0) return null;

    // aria-label avoids "Variable income" so it doesn't collide with the income form's
    // "Variable income" checkbox now that both live on the Expenses hub.
  return (
    <section className="mb-8" aria-label="This month's actuals">
      <p className={labelClass}>// variable income — this month&apos;s actuals</p>
      <ul className="mt-3 grid gap-4 sm:grid-cols-2">
        {incomes.map((income) => (
          <OverrideRow key={income.id} income={income} billingMonth={billingMonth} />
        ))}
      </ul>
    </section>
  );
}
