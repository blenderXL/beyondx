"use client";

import { useActionState } from "react";
import { Trash2, Info } from "lucide-react";
import { DebtAccountFormCard } from "@/components/finance/DebtAccountFormCard";
import { TransactionForm } from "@/components/finance/TransactionForm";
import { archiveDebt, deleteTransaction } from "@/app/(app)/actions";
import { INITIAL_FINANCE_STATE } from "@/lib/finance/actionState";
import { formatUsd } from "@/lib/finance/derive";
import { SparkArea } from "@/components/finance/charts";
import { monthlyBalanceSeries } from "@/lib/finance/balanceHistory";
import { labelClass, errorClass } from "@/components/finance/formStyles";
import type { Debt } from "@/lib/finance/types";

/** One of a debt's transactions, with whether it originated from an expense check-off. */
export interface DebtTxn {
  id: string;
  kind: "charge" | "payment" | "contribution";
  amount: number;
  occurredOn: string;
  note: string | null;
  /** True when the txn came from paying a debt-linked expense — not deletable here. */
  fromExpense: boolean;
}

/**
 * The debt "card detail" — opened by clicking a debt card. Holds everything that used to be
 * separate buttons: edit the account, see + add + delete transactions, and archive. Rendered
 * inside the shared click-away Modal.
 */
export function DebtDetail({ debt, txns, onClose }: { debt: Debt; txns: DebtTxn[]; onClose: () => void }) {
  const trend = monthlyBalanceSeries(Number(debt.balance), txns);
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={labelClass}>// debt</p>
          <h2 className="mt-1 font-sans text-xl font-medium text-[var(--color-text-primary)]">{debt.name}</h2>
          <p className="mt-1 font-mono text-[11px] text-[var(--color-text-muted)]">
            Balance{" "}
            <span className="tabular-nums text-[var(--color-text-secondary)]">{formatUsd(Number(debt.balance))}</span>
          </p>
        </div>
        <ArchiveButton debt={debt} />
      </div>

      {/* Two-column: edit the account on the left; trend + transactions + log on the right. */}
      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
        {/* Keyed by updated_at so the edit form's defaults refresh after a transaction changes the balance. */}
        <DebtAccountFormCard key={debt.updated_at} debt={debt} onDone={onClose} onCancel={onClose} />

        <div className="mt-6 space-y-6 lg:mt-0">
          {trend.length >= 2 ? (
            <section className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-4">
              <p className={labelClass}>// balance trend</p>
              <div className="mt-3">
                <SparkArea values={trend} accentVar="--color-accent-emerald" height={96} />
              </div>
            </section>
          ) : null}

          {/* Log a transaction first, then the history list below it. */}
          <TransactionForm debt={debt} onDone={() => {}} onCancel={onClose} />

          <section>
            <p className={labelClass}>// transactions</p>
            {txns.length === 0 ? (
              <p className="mt-3 font-mono text-[11px] text-[var(--color-text-muted)]">// no transactions yet</p>
            ) : (
              <ul className="mt-3 divide-y divide-[var(--color-border-subtle)] overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)]">
                {txns.map((t) => (
                  <TxnRow key={t.id} txn={t} />
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function TxnRow({ txn }: { txn: DebtTxn }) {
  const [state, formAction, pending] = useActionState(deleteTransaction, INITIAL_FINANCE_STATE);
  // A payment pays the balance down (emerald, −); a charge adds new spend (amber, +).
  const isPayment = txn.kind === "payment";
  const isCharge = txn.kind === "charge";
  const tone = isPayment ? "--color-accent-emerald" : isCharge ? "--color-accent-amber" : "--color-text-secondary";
  const label = isPayment ? "Paid down" : isCharge ? "Added to balance" : "Contribution";
  return (
    <li className="relative flex items-center justify-between gap-4 py-3 pl-4 pr-4">
      <span aria-hidden className="absolute left-0 top-0 h-full w-0.5" style={{ background: `var(${tone})` }} />
      <div className="min-w-0">
        <p className="font-sans text-sm text-[var(--color-text-primary)]">
          {label}
          {txn.fromExpense ? " · from expense" : ""}
        </p>
        <p className="font-mono text-[11px] text-[var(--color-text-muted)]">
          {txn.occurredOn}
          {txn.note ? ` · ${txn.note}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="font-mono text-sm tabular-nums" style={{ color: `var(${tone})` }}>
          {isPayment ? "−" : isCharge ? "+" : ""}
          {formatUsd(txn.amount)}
        </span>
        {txn.fromExpense ? (
          // Expense-originated payment: delete is disabled; explain where to revert it.
          <span className="group relative">
            <button
              type="button"
              disabled
              aria-label="Delete (disabled — revert on the Expenses page)"
              className="flex size-7 cursor-not-allowed items-center justify-center rounded text-[var(--color-text-muted)] opacity-40"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
            <span
              role="tooltip"
              className="pointer-events-none absolute right-0 top-full z-10 mt-1 w-56 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] p-2 font-mono text-[10px] leading-relaxed text-[var(--color-text-secondary)] opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
            >
              <Info className="mr-1 inline size-3 align-[-2px]" aria-hidden />
              This payment came from an expense. To remove it, go to the Expenses page for that month
              and revert the payoff.
            </span>
          </span>
        ) : (
          <form action={formAction}>
            <input type="hidden" name="id" value={txn.id} />
            <button
              type="submit"
              disabled={pending}
              aria-label="Delete transaction"
              className="flex size-7 items-center justify-center rounded text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-accent-red)] disabled:opacity-40"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </form>
        )}
      </div>
      {state.error ? (
        <span role="alert" className={errorClass}>
          {state.error}
        </span>
      ) : null}
    </li>
  );
}

function ArchiveButton({ debt }: { debt: Debt }) {
  const [state, formAction] = useActionState(archiveDebt, INITIAL_FINANCE_STATE);
  // On success the page revalidates, the debt drops out of `debts`, and the modal closes itself
  // (DebtsClient resolves the detail debt from the live list).
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(`Archive "${debt.name}"? It'll be hidden from your active debts.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={debt.id} />
      <button
        type="submit"
        className="flex h-9 items-center rounded-md px-3 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-accent-red)]"
      >
        Archive
      </button>
      {state.error ? <span role="alert" className={`ml-2 ${errorClass}`}>{state.error}</span> : null}
    </form>
  );
}
