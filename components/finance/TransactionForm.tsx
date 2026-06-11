"use client";

import { useActionState, useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { addTransaction } from "@/app/(app)/actions";
import { INITIAL_FINANCE_STATE } from "@/lib/finance/actionState";
import { applyTransactionToBalance } from "@/lib/finance/balance";
import { formatUsd } from "@/lib/finance/derive";
import type { Debt } from "@/lib/finance/types";
import {
  inputClass,
  dateInputClass,
  labelClass,
  primaryButtonClass,
  ghostButtonClass,
  errorClass,
} from "@/components/finance/formStyles";

interface Props {
  debt: Debt;
  onDone: () => void;
  onCancel: () => void;
}

type Kind = "payment" | "charge";

/** Log money against one debt: a payment (paid down → balance falls) or a charge (new spend
 * → balance rises). A live preview shows where the balance lands. */
export function TransactionForm({ debt, onDone, onCancel }: Props) {
  const [state, formAction, pending] = useActionState(addTransaction, INITIAL_FINANCE_STATE);
  const [kind, setKind] = useState<Kind>("payment");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  const current = Number(debt.balance);
  const n = Number(amount);
  const hasAmount = amount.trim() !== "" && Number.isFinite(n) && n > 0;
  const next = hasAmount ? applyTransactionToBalance(current, kind, n) : current;

  const options: { v: Kind; label: string; hint: string; Icon: typeof ArrowDown }[] = [
    { v: "payment", label: "Paid down", hint: "lowers the balance", Icon: ArrowDown },
    { v: "charge", label: "New charge", hint: "adds to the balance", Icon: ArrowUp },
  ];

  return (
    <form
      action={formAction}
      className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-6"
    >
      <p className={labelClass}>// log transaction</p>
      <h2 className="mt-2 mb-6 font-sans text-xl font-medium text-[var(--color-text-primary)]">{debt.name}</h2>

      <input type="hidden" name="debt_id" value={debt.id} />
      <input type="hidden" name="kind" value={kind} />

      {/* Two-way: paid down vs new charge. */}
      <div role="group" aria-label="Transaction type" className="grid grid-cols-2 gap-2">
        {options.map(({ v, label, hint, Icon }) => {
          const on = kind === v;
          const tone = v === "payment" ? "--color-accent-emerald" : "--color-accent-amber";
          return (
            <button
              key={v}
              type="button"
              onClick={() => setKind(v)}
              aria-pressed={on}
              className="rounded-md border p-3 text-left transition-colors"
              style={{
                borderColor: on ? `var(${tone})` : "var(--color-border-strong)",
                background: on ? `color-mix(in oklab, var(${tone}), transparent 90%)` : "var(--color-elevated)",
              }}
            >
              <span
                className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em]"
                style={{ color: on ? `var(${tone})` : "var(--color-text-secondary)" }}
              >
                <Icon className="size-3.5" aria-hidden />
                {label}
              </span>
              <span className="mt-1 block font-mono text-[10px] text-[var(--color-text-muted)]">{hint}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Amount</span>
          <input
            type="text"
            inputMode="decimal"
            name="amount"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className={labelClass}>Date</span>
          <input type="date" name="occurred_on" className={dateInputClass} />
        </label>

        <label className="block sm:col-span-2">
          <span className={labelClass}>Note</span>
          <input type="text" name="note" maxLength={500} placeholder="optional" className={inputClass} />
        </label>
      </div>

      {/* Live preview of where the balance lands. */}
      <div className="mt-4 flex items-center justify-between rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-elevated)] px-3 py-2 font-mono text-[12px]">
        <span className="text-[var(--color-text-muted)]">{formatUsd(current)}</span>
        <span className="text-[var(--color-text-muted)]">→</span>
        <span
          className="tabular-nums"
          style={{
            color: !hasAmount
              ? "var(--color-text-secondary)"
              : kind === "payment"
                ? "var(--color-accent-emerald)"
                : "var(--color-accent-amber)",
          }}
        >
          {formatUsd(next)}
        </span>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? "Recording…" : "Record"}
        </button>
        <button type="button" onClick={onCancel} className={ghostButtonClass}>
          Cancel
        </button>
      </div>

      {state.error ? (
        <p role="alert" className={`mt-4 ${errorClass}`}>
          // {state.error}
        </p>
      ) : null}
    </form>
  );
}
