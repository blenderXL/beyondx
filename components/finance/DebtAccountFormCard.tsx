"use client";

import { useActionState, useEffect, useState } from "react";
import { createDebt, updateDebt } from "@/app/(app)/actions";
import { INITIAL_FINANCE_STATE } from "@/lib/finance/actionState";
import {
  creditLimitApplies,
  dueDateApplies,
  cardExtrasApply,
  type Debt,
  type DebtType,
} from "@/lib/finance/types";
import { DebtTypeIcon } from "@/components/finance/DebtTypeIcon";
import { DebtTypeSelect } from "@/components/finance/DebtTypeSelect";
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

/** Red asterisk for required fields. */
function Req() {
  return <span className="text-[var(--color-accent-red)]"> *</span>;
}

/** Mono helper line under a field. */
function Helper({ children }: { children: React.ReactNode }) {
  return <span className="mt-1 block font-mono text-[10px] text-[var(--color-text-muted)]">{children}</span>;
}

function formatCurrency(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function stripMoney(s: string): string {
  return s.replace(/[$,\s]/g, "");
}

/**
 * Money field (uncontrolled): shows raw digits while focused and re-formats to
 * "$1,234.50" on blur by mutating the DOM value directly. Submits whatever string it
 * holds — the server's `parseMoney` strips `$ ,`, so raw or formatted both validate.
 * Uncontrolled keeps it simple and plays nicely with autofill / programmatic fills.
 */
function CurrencyInput({
  name,
  ariaLabel,
  defaultValue,
  required,
}: {
  name: string;
  ariaLabel: string;
  defaultValue?: number | null;
  required?: boolean;
}) {
  return (
    <input
      type="text"
      inputMode="decimal"
      name={name}
      aria-label={ariaLabel}
      required={required}
      defaultValue={defaultValue != null ? formatCurrency(defaultValue) : ""}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={(e) => {
        const n = Number(stripMoney(e.target.value));
        if (e.target.value.trim() !== "" && Number.isFinite(n)) e.target.value = formatCurrency(n);
      }}
      placeholder="$0.00"
      className={inputClass}
    />
  );
}

/**
 * Reusable, type-aware debt form. The selected "Type of debt" drives which fields show
 * via the predicates in `lib/finance/types.ts` (`creditLimitApplies` / `dueDateApplies`
 * / `cardExtrasApply`) — add a rule there and the form + server validator both honor it.
 */
export function DebtAccountFormCard({ debt, onDone, onCancel }: Props) {
  const editing = Boolean(debt);
  const [type, setType] = useState<DebtType>(debt?.type ?? "credit_card");
  const [state, formAction, pending] = useActionState(
    editing ? updateDebt : createDebt,
    INITIAL_FINANCE_STATE,
  );

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  const showCreditLimit = creditLimitApplies(type);
  const showDueDate = dueDateApplies(type);
  const showCardExtras = cardExtrasApply(type);

  return (
    <form
      action={formAction}
      className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-6"
    >
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className={labelClass}>// {editing ? "edit debt account" : "new debt account"}</p>
          <h2 className="mt-2 mb-1 font-sans text-xl font-medium text-[var(--color-text-primary)]">
            {editing ? debt!.name : "Add a debt account"}
          </h2>
          <p className="font-mono text-[11px] text-[var(--color-text-muted)]">
            // fields adapt to the debt type · <span className="text-[var(--color-accent-red)]">*</span> required
          </p>
        </div>
        {/* Selected-type icon — reflects the dropdown choice at a glance. */}
        <span className="shrink-0 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-elevated)] p-3 text-[var(--color-text-secondary)]">
          <DebtTypeIcon type={type} className="size-6" />
        </span>
      </div>

      {editing ? <input type="hidden" name="id" value={debt!.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Always visible */}
        <label className="block sm:col-span-2">
          <span className={labelClass}>
            Debt nickname / description
            <Req />
          </span>
          <input
            type="text"
            name="name"
            aria-label="Debt nickname / description"
            required
            maxLength={120}
            defaultValue={debt?.name}
            placeholder="Chase Sapphire, Tesla loan…"
            className={inputClass}
          />
        </label>

        <div className="block">
          <span className={labelClass}>
            Type of debt
            <Req />
          </span>
          <DebtTypeSelect value={type} onChange={setType} />
        </div>

        <label className="block">
          <span className={labelClass}>
            Current balance
            <Req />
          </span>
          <CurrencyInput name="balance" ariaLabel="Current balance" defaultValue={debt?.balance} required />
          <Helper>We track current balance only — your first entry is saved as the starting baseline.</Helper>
        </label>

        <label className="block">
          <span className={labelClass}>
            Minimum payment
            <Req />
          </span>
          <CurrencyInput name="min_payment" ariaLabel="Minimum payment" defaultValue={debt?.min_payment} required />
        </label>

        <label className="block">
          <span className={labelClass}>Interest rate (%)</span>
          <input
            type="text"
            inputMode="decimal"
            name="apr"
            aria-label="Interest rate (%)"
            defaultValue={debt?.apr ?? ""}
            placeholder="0.000"
            className={inputClass}
          />
          <Helper>Up to 3 decimals (e.g. 24.750).</Helper>
        </label>

        {/* Credit limit — credit cards only */}
        {showCreditLimit ? (
          <label className="block">
            <span className={labelClass}>Credit limit</span>
            <CurrencyInput name="credit_limit" ariaLabel="Credit limit" defaultValue={debt?.credit_limit} />
            <Helper>Used for credit-utilization.</Helper>
          </label>
        ) : null}

        {/* Next due date — every type except medical / savings-club */}
        {showDueDate ? (
          <label className="block">
            <span className={labelClass}>
              Next due date
              <Req />
            </span>
            <input
              type="date"
              name="next_due_date"
              aria-label="Next due date"
              required
              defaultValue={debt?.next_due_date ?? ""}
              className={dateInputClass}
            />
            <Helper>When the next payment is due.</Helper>
          </label>
        ) : null}

        {/* Card-only: issuer + promotional financing */}
        {showCardExtras ? (
          <>
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
            <label className="block">
              <span className={labelClass}>Promo APR (%)</span>
              <input
                type="text"
                inputMode="decimal"
                name="promo_apr"
                defaultValue={debt?.promo_apr ?? ""}
                placeholder="0.000"
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
          </>
        ) : null}

        {/* Always visible, optional */}
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
