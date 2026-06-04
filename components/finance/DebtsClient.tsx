"use client";

import { useActionState, useCallback, useState } from "react";
import { StatCard } from "@/components/layout/StatCard";
import { DebtAccountFormCard } from "@/components/finance/DebtAccountFormCard";
import { TransactionForm } from "@/components/finance/TransactionForm";
import { archiveDebt } from "@/app/(app)/actions";
import { INITIAL_FINANCE_STATE } from "@/lib/finance/actionState";
import { DEBT_TYPE_LABELS, type Debt, type TransactionKind } from "@/lib/finance/types";
import { DebtTypeIcon } from "@/components/finance/DebtTypeIcon";
import { formatUsd, formatPercent, utilization, payoffProgress, formatDueDate } from "@/lib/finance/derive";
import {
  labelClass,
  primaryButtonClass,
  ghostButtonClass,
  errorClass,
} from "@/components/finance/formStyles";

export interface RecentActivity {
  id: string;
  kind: TransactionKind;
  amount: number;
  occurredOn: string;
  note: string | null;
  debtName: string | null;
}

interface Props {
  debts: Debt[];
  recent: RecentActivity[];
}

type Mode =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "edit"; debt: Debt }
  | { kind: "txn"; debt: Debt };

export function DebtsClient({ debts, recent }: Props) {
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const toList = useCallback(() => setMode({ kind: "list" }), []);

  const totalBalance = debts.reduce((sum, d) => sum + Number(d.balance), 0);
  const totalMin = debts.reduce((sum, d) => sum + Number(d.min_payment), 0);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className={labelClass}>// debts</p>
          <h1 className="mt-2 font-sans text-3xl font-medium text-[var(--color-text-primary)]">
            Your debts
          </h1>
        </div>
        {mode.kind === "list" ? (
          <button onClick={() => setMode({ kind: "create" })} className={primaryButtonClass}>
            New debt
          </button>
        ) : null}
      </header>

      {mode.kind === "create" ? <DebtAccountFormCard onDone={toList} onCancel={toList} /> : null}
      {mode.kind === "edit" ? (
        <DebtAccountFormCard debt={mode.debt} onDone={toList} onCancel={toList} />
      ) : null}
      {mode.kind === "txn" ? (
        <TransactionForm debt={mode.debt} onDone={toList} onCancel={toList} />
      ) : null}

      {mode.kind === "list" ? (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Total balance"
              value={formatUsd(totalBalance)}
              accentVar="--color-accent-red"
            />
            <StatCard
              label="Active debts"
              value={String(debts.length)}
              accentVar="--color-accent-blue"
            />
            <StatCard
              label="Total minimums"
              value={formatUsd(totalMin)}
              hint="per month"
              accentVar="--color-accent-amber"
            />
          </div>

          {debts.length === 0 ? (
            <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-strong)] p-10 text-center">
              <p className="font-mono text-sm text-[var(--color-text-muted)]">
                // no debts yet — add your first to start tracking
              </p>
            </div>
          ) : (
            <ul aria-label="Debts" className="grid gap-4 lg:grid-cols-2">
              {debts.map((debt) => (
                <DebtCard
                  key={debt.id}
                  debt={debt}
                  onEdit={() => setMode({ kind: "edit", debt })}
                  onTxn={() => setMode({ kind: "txn", debt })}
                />
              ))}
            </ul>
          )}

          <ActivityCard recent={recent} />
        </>
      ) : null}
    </div>
  );
}

function DebtCard({ debt, onEdit, onTxn }: { debt: Debt; onEdit: () => void; onTxn: () => void }) {
  const util = utilization(
    Number(debt.balance),
    debt.credit_limit === null ? null : Number(debt.credit_limit),
  );
  const progress = payoffProgress(
    Number(debt.balance),
    debt.original_balance === null ? null : Number(debt.original_balance),
  );

  return (
    <li className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] p-2 text-[var(--color-text-secondary)]">
            <DebtTypeIcon type={debt.type} className="size-4" />
          </span>
          <div>
            <p className="font-sans text-base font-medium text-[var(--color-text-primary)]">
              {debt.name}
            </p>
            <p className="mt-1 font-mono text-[11px] tracking-[0.18em] text-[var(--color-text-muted)] uppercase">
              {DEBT_TYPE_LABELS[debt.type]}
              {debt.issuer ? ` · ${debt.issuer}` : ""}
            </p>
          </div>
        </div>
        <p className="font-sans text-2xl font-medium text-[var(--color-text-primary)] tabular-nums">
          {formatUsd(Number(debt.balance))}
        </p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-y-2 font-mono text-[11px] text-[var(--color-text-secondary)] sm:grid-cols-4">
        <Stat label="APR" value={formatPercent(Number(debt.apr))} />
        <Stat label="Min" value={formatUsd(Number(debt.min_payment))} />
        <Stat label="Due" value={formatDueDate(debt.next_due_date, debt.due_day)} />
        <Stat label="Util" value={util === null ? "—" : `${Math.round(util * 100)}%`} />
      </dl>

      {progress !== null ? (
        <div className="mt-4">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-elevated)]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.round(progress * 100)}%`,
                background: "var(--color-accent-emerald)",
              }}
            />
          </div>
          <p className="mt-1 font-mono text-[10px] text-[var(--color-text-muted)]">
            {Math.round(progress * 100)}% paid off
          </p>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button onClick={onTxn} className={primaryButtonClass}>
          Add transaction
        </button>
        <button onClick={onEdit} className={ghostButtonClass}>
          Edit
        </button>
        <ArchiveButton debt={debt} />
      </div>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[var(--color-text-muted)]">{label}</dt>
      <dd className="text-[var(--color-text-primary)] tabular-nums">{value}</dd>
    </div>
  );
}

function ArchiveButton({ debt }: { debt: Debt }) {
  const [state, formAction] = useActionState(archiveDebt, INITIAL_FINANCE_STATE);

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
        className="flex h-11 items-center justify-center rounded-md px-4 font-mono text-xs tracking-[0.18em] text-[var(--color-text-muted)] uppercase transition-colors hover:text-[var(--color-accent-red)]"
      >
        Archive
      </button>
      {state.error ? (
        <span role="alert" className={`ml-2 ${errorClass}`}>
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

function ActivityCard({ recent }: { recent: RecentActivity[] }) {
  if (recent.length === 0) return null;
  return (
    <section className="mt-10">
      <p className={labelClass}>// recent activity</p>
      <ul
        aria-label="Recent activity"
        className="mt-3 divide-y divide-[var(--color-border-subtle)] rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)]"
      >
        {recent.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-4 px-5 py-3">
            <div className="min-w-0">
              <p className="truncate font-sans text-sm text-[var(--color-text-primary)]">
                {t.kind === "payment" ? "Payment" : t.kind === "charge" ? "Charge" : "Contribution"}
                {t.debtName ? ` · ${t.debtName}` : ""}
              </p>
              <p className="font-mono text-[11px] text-[var(--color-text-muted)]">
                {t.occurredOn}
                {t.note ? ` · ${t.note}` : ""}
              </p>
            </div>
            <p
              className="shrink-0 font-mono text-sm tabular-nums"
              style={{
                color:
                  t.kind === "payment"
                    ? "var(--color-accent-emerald)"
                    : "var(--color-text-primary)",
              }}
            >
              {t.kind === "payment" ? "−" : "+"}
              {formatUsd(t.amount)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
