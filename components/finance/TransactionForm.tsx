"use client";

import { useActionState, useEffect } from "react";
import { addTransaction } from "@/app/(app)/actions";
import { INITIAL_FINANCE_STATE } from "@/lib/finance/actionState";
import type { Debt } from "@/lib/finance/types";
import {
  inputClass,
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

/** Log a charge (raises the balance) or payment (lowers it) against one debt. */
export function TransactionForm({ debt, onDone, onCancel }: Props) {
  const [state, formAction, pending] = useActionState(addTransaction, INITIAL_FINANCE_STATE);

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form
      action={formAction}
      className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-6"
    >
      <p className={labelClass}>// log transaction</p>
      <h2 className="mt-2 mb-6 font-sans text-xl font-medium text-[var(--color-text-primary)]">
        {debt.name}
      </h2>

      <input type="hidden" name="debt_id" value={debt.id} />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Type</span>
          <select name="kind" aria-label="Type" defaultValue="payment" className={inputClass}>
            <option value="payment">Payment (reduce balance)</option>
            <option value="charge">Charge (increase balance)</option>
          </select>
        </label>

        <label className="block">
          <span className={labelClass}>Amount</span>
          <input
            type="text"
            inputMode="decimal"
            name="amount"
            required
            placeholder="0.00"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className={labelClass}>Date</span>
          <input type="date" name="occurred_on" className={inputClass} />
        </label>

        <label className="block">
          <span className={labelClass}>Note</span>
          <input
            type="text"
            name="note"
            maxLength={500}
            placeholder="optional"
            className={inputClass}
          />
        </label>
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
