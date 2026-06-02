"use client";

import { useActionState } from "react";
import { togglePaid } from "@/app/(app)/actions";
import { INITIAL_FINANCE_STATE } from "@/lib/finance/actionState";
import { formatUsd } from "@/lib/finance/derive";
import { labelClass } from "@/components/finance/formStyles";

export interface PlannerBill {
  kind: "expense" | "debt";
  id: string;
  name: string;
  sublabel: string;
  amount: number;
  dueDay: number | null;
  paid: boolean;
}

function PaidToggle({ bill, billingMonth }: { bill: PlannerBill; billingMonth: string }) {
  const [, formAction] = useActionState(togglePaid, INITIAL_FINANCE_STATE);
  return (
    <form action={formAction} className="shrink-0">
      <input type="hidden" name="kind" value={bill.kind} />
      <input type="hidden" name="item_id" value={bill.id} />
      <input type="hidden" name="billing_month" value={billingMonth} />
      <input type="hidden" name="amount" value={bill.amount} />
      <input
        type="checkbox"
        name="checked"
        aria-label={`Mark ${bill.name} paid`}
        defaultChecked={bill.paid}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="size-4 cursor-pointer accent-[var(--color-accent-emerald)]"
      />
    </form>
  );
}

export function PlannerBills({ bills, billingMonth }: { bills: PlannerBill[]; billingMonth: string }) {
  if (bills.length === 0) return null;
  const total = bills.reduce((s, b) => s + b.amount, 0);
  const paidTotal = bills.filter((b) => b.paid).reduce((s, b) => s + b.amount, 0);
  const paidCount = bills.filter((b) => b.paid).length;

  return (
    <section className="mt-8">
      <div className="flex items-end justify-between gap-4">
        <p className={labelClass}>// bills this month</p>
        <p className="font-mono text-[11px] text-[var(--color-text-muted)] tabular-nums">
          {paidCount}/{bills.length} paid · {formatUsd(paidTotal)} of {formatUsd(total)}
        </p>
      </div>

      <ul
        aria-label="Bills this month"
        className="mt-3 divide-y divide-[var(--color-border-subtle)] rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)]"
      >
        {bills.map((b) => (
          <li key={`${b.kind}-${b.id}`} className="flex items-center gap-4 px-5 py-3">
            <PaidToggle bill={b} billingMonth={billingMonth} />
            <div className="min-w-0 flex-1">
              <p
                className={`truncate font-sans text-sm ${
                  b.paid
                    ? "text-[var(--color-text-muted)] line-through"
                    : "text-[var(--color-text-primary)]"
                }`}
              >
                {b.name}
              </p>
              <p className="font-mono text-[11px] text-[var(--color-text-muted)]">
                {b.sublabel}
                {b.dueDay ? ` · due day ${b.dueDay}` : ""}
              </p>
            </div>
            <p className="shrink-0 font-mono text-sm tabular-nums text-[var(--color-text-secondary)]">
              {formatUsd(b.amount)}
            </p>
          </li>
        ))}
      </ul>

      <p className="mt-2 font-mono text-[10px] text-[var(--color-text-muted)]">
        // check off what you&apos;ve paid this month · debt balances are managed on the Debts page
      </p>
    </section>
  );
}
