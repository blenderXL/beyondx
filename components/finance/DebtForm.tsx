"use client";

import { useActionState, useEffect } from "react";
import { createDebt, updateDebt } from "@/app/(app)/actions";
import { INITIAL_FINANCE_STATE } from "@/lib/finance/actionState";
import { DEBT_TYPES, DEBT_TYPE_LABELS, type Debt } from "@/lib/finance/types";
import {
  inputClass,
  dateInputClass,
  labelClass,
  textareaClass,
  primaryButtonClass,
  ghostButtonClass,
  errorClass,
} from "@/components/finance/formStyles";

interface Props {
  /** When present the form edits this debt; otherwise it creates a new one. */
  debt?: Debt;
  onDone: () => void;
  onCancel: () => void;
}

/** Field that holds a money value — kept as text so "$1,234.50" pastes cleanly; the server parses it. */
function MoneyField({
  name,
  label,
  defaultValue,
  required,
}: {
  name: string;
  label: string;
  defaultValue?: number | null;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <input
        type="text"
        inputMode="decimal"
        name={name}
        required={required}
        defaultValue={defaultValue ?? ""}
        placeholder="0.00"
        className={inputClass}
      />
    </label>
  );
}

export function DebtForm({ debt, onDone, onCancel }: Props) {
  const editing = Boolean(debt);
  const [state, formAction, pending] = useActionState(
    editing ? updateDebt : createDebt,
    INITIAL_FINANCE_STATE,
  );

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form
      action={formAction}
      className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-6"
    >
      <p className={labelClass}>// {editing ? "edit debt" : "new debt"}</p>
      <h2 className="mt-2 mb-6 font-sans text-xl font-medium text-[var(--color-text-primary)]">
        {editing ? debt!.name : "Add a debt"}
      </h2>

      {editing ? <input type="hidden" name="id" value={debt!.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className={labelClass}>Name</span>
          <input
            type="text"
            name="name"
            required
            maxLength={120}
            defaultValue={debt?.name}
            placeholder="Chase Sapphire, Tesla loan…"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className={labelClass}>Type</span>
          <select
            name="type"
            aria-label="Type"
            defaultValue={debt?.type ?? "credit_card"}
            className={inputClass}
          >
            {DEBT_TYPES.map((t) => (
              <option key={t} value={t}>
                {DEBT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={labelClass}>Issuer</span>
          <input
            type="text"
            name="issuer"
            maxLength={120}
            defaultValue={debt?.issuer ?? ""}
            placeholder="Chase, Capital One…"
            className={inputClass}
          />
        </label>

        <MoneyField name="balance" label="Current balance" defaultValue={debt?.balance} required />
        <MoneyField name="credit_limit" label="Credit limit" defaultValue={debt?.credit_limit} />
        <MoneyField name="min_payment" label="Minimum payment" defaultValue={debt?.min_payment} />

        <label className="block">
          <span className={labelClass}>APR (%)</span>
          <input
            type="text"
            inputMode="decimal"
            name="apr"
            defaultValue={debt?.apr ?? ""}
            placeholder="24.24"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className={labelClass}>Due day</span>
          <input
            type="number"
            name="due_day"
            min={1}
            max={31}
            step={1}
            defaultValue={debt?.due_day ?? ""}
            placeholder="1–31"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className={labelClass}>Promo APR (%)</span>
          <input
            type="text"
            inputMode="decimal"
            name="promo_apr"
            defaultValue={debt?.promo_apr ?? ""}
            placeholder="0.00"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className={labelClass}>Promo ends</span>
          <input
            type="date"
            name="promo_until"
            defaultValue={debt?.promo_until ?? ""}
            className={dateInputClass}
          />
        </label>

        <label className="flex items-center gap-3 sm:col-span-2">
          <input
            type="checkbox"
            name="deferred_interest"
            defaultChecked={debt?.deferred_interest ?? false}
            className="size-4 accent-[var(--color-accent-amber)]"
          />
          <span className={labelClass}>Deferred interest (e.g. promotional financing)</span>
        </label>

        <label className="block sm:col-span-2">
          <span className={labelClass}>Notes</span>
          <textarea
            name="notes"
            maxLength={2000}
            defaultValue={debt?.notes ?? ""}
            placeholder="Anything worth remembering about this account…"
            className={textareaClass}
          />
        </label>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? "Saving…" : editing ? "Save debt" : "Add debt"}
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
