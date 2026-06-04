"use client";

import { useActionState, useCallback, useEffect, useMemo, useState } from "react";
import { LayoutGrid, List, Search } from "lucide-react";
import { StatCard } from "@/components/layout/StatCard";
import { DebtAccountFormCard } from "@/components/finance/DebtAccountFormCard";
import { TransactionForm } from "@/components/finance/TransactionForm";
import { archiveDebt } from "@/app/(app)/actions";
import { INITIAL_FINANCE_STATE } from "@/lib/finance/actionState";
import { DEBT_TYPE_LABELS, DEBT_TYPES, type Debt, type DebtType, type TransactionKind } from "@/lib/finance/types";
import { filterAndSortDebts, DEBT_SORTS, type DebtSort } from "@/lib/finance/debtsView";
import { DebtTypeIcon } from "@/components/finance/DebtTypeIcon";
import { formatUsd, formatPercent, utilization, payoffProgress, formatDueDate } from "@/lib/finance/derive";
import {
  inputClass,
  labelClass,
  primaryButtonClass,
  ghostButtonClass,
  errorClass,
} from "@/components/finance/formStyles";

type DebtView = "card" | "list";
const VIEW_KEY = "nzx.debts.view";
const SORT_KEY = "nzx.debts.sort";

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

  // List controls (client-side over the loaded debts).
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<DebtType | "all">("all");
  const [sort, setSort] = useState<DebtSort>("balance_desc");
  const [view, setView] = useState<DebtView>("card");

  // Persist view + sort across reloads (validated; hydrated post-mount to avoid SSR mismatch).
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      if (v === "card" || v === "list") setView(v);
      const s = localStorage.getItem(SORT_KEY);
      if (s && DEBT_SORTS.some((o) => o.value === s)) setSort(s as DebtSort);
    } catch {
      /* storage unavailable — use defaults */
    }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(VIEW_KEY, view);
      localStorage.setItem(SORT_KEY, sort);
    } catch {
      /* ignore */
    }
  }, [hydrated, view, sort]);

  // Only offer type-filter options for types the user actually has.
  const presentTypes = useMemo(
    () => DEBT_TYPES.filter((t) => debts.some((d) => d.type === t)),
    [debts],
  );
  const visibleDebts = useMemo(
    () => filterAndSortDebts(debts, { query, type: typeFilter, sort }),
    [debts, query, typeFilter, sort],
  );

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
            <>
              <DebtControls
                query={query}
                onQuery={setQuery}
                typeFilter={typeFilter}
                onTypeFilter={setTypeFilter}
                presentTypes={presentTypes}
                sort={sort}
                onSort={setSort}
                view={view}
                onView={setView}
              />

              {visibleDebts.length === 0 ? (
                <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-strong)] p-10 text-center">
                  <p className="font-mono text-sm text-[var(--color-text-muted)]">
                    // no debts match your search or filter
                  </p>
                </div>
              ) : view === "card" ? (
                <ul aria-label="Debts" className="grid gap-4 lg:grid-cols-2">
                  {visibleDebts.map((debt) => (
                    <DebtCard
                      key={debt.id}
                      debt={debt}
                      onEdit={() => setMode({ kind: "edit", debt })}
                      onTxn={() => setMode({ kind: "txn", debt })}
                    />
                  ))}
                </ul>
              ) : (
                <ul
                  aria-label="Debts"
                  className="divide-y divide-[var(--color-border-subtle)] overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)]"
                >
                  {visibleDebts.map((debt) => (
                    <DebtRow
                      key={debt.id}
                      debt={debt}
                      onEdit={() => setMode({ kind: "edit", debt })}
                      onTxn={() => setMode({ kind: "txn", debt })}
                    />
                  ))}
                </ul>
              )}
            </>
          )}

          <ActivityCard recent={recent} />
        </>
      ) : null}
    </div>
  );
}

function DebtControls({
  query,
  onQuery,
  typeFilter,
  onTypeFilter,
  presentTypes,
  sort,
  onSort,
  view,
  onView,
}: {
  query: string;
  onQuery: (v: string) => void;
  typeFilter: DebtType | "all";
  onTypeFilter: (v: DebtType | "all") => void;
  presentTypes: readonly DebtType[];
  sort: DebtSort;
  onSort: (v: DebtSort) => void;
  view: DebtView;
  onView: (v: DebtView) => void;
}) {
  const selectClass = `${inputClass} mt-0 h-10`;
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <div className="relative min-w-[12rem] flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-text-muted)]"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          aria-label="Search debts"
          placeholder="Search by name or issuer…"
          className={`${inputClass} mt-0 h-10 pl-9`}
        />
      </div>

      <select
        value={typeFilter}
        onChange={(e) => onTypeFilter(e.target.value as DebtType | "all")}
        aria-label="Filter by type"
        className={`${selectClass} w-auto`}
      >
        <option value="all">All types</option>
        {presentTypes.map((t) => (
          <option key={t} value={t}>
            {DEBT_TYPE_LABELS[t]}
          </option>
        ))}
      </select>

      <select
        value={sort}
        onChange={(e) => onSort(e.target.value as DebtSort)}
        aria-label="Sort debts"
        className={`${selectClass} w-auto`}
      >
        {DEBT_SORTS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <div className="flex h-10 items-center rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] p-0.5">
        {(
          [
            { v: "card" as const, Icon: LayoutGrid, label: "Card view" },
            { v: "list" as const, Icon: List, label: "List view" },
          ]
        ).map(({ v, Icon, label }) => (
          <button
            key={v}
            type="button"
            onClick={() => onView(v)}
            aria-label={label}
            aria-pressed={view === v}
            className={`flex size-8 items-center justify-center rounded ${
              view === v
                ? "bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            <Icon className="size-4" aria-hidden />
          </button>
        ))}
      </div>
    </div>
  );
}

function DebtRow({ debt, onEdit, onTxn }: { debt: Debt; onEdit: () => void; onTxn: () => void }) {
  const util = utilization(
    Number(debt.balance),
    debt.credit_limit === null ? null : Number(debt.credit_limit),
  );
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
      <span className="shrink-0 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] p-2 text-[var(--color-text-secondary)]">
        <DebtTypeIcon type={debt.type} className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-sans text-sm font-medium text-[var(--color-text-primary)]">{debt.name}</p>
        <p className="truncate font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
          {DEBT_TYPE_LABELS[debt.type]}
        </p>
      </div>
      <dl className="flex shrink-0 items-center gap-x-5 font-mono text-[11px] text-[var(--color-text-secondary)]">
        <RowStat label="Bal" value={formatUsd(Number(debt.balance))} />
        <RowStat label="APR" value={formatPercent(Number(debt.apr))} />
        <RowStat label="Min" value={formatUsd(Number(debt.min_payment))} />
        <RowStat label="Due" value={formatDueDate(debt.next_due_date, debt.due_day)} />
        <RowStat label="Util" value={util === null ? "—" : `${Math.round(util * 100)}%`} />
      </dl>
      <div className="flex shrink-0 items-center gap-2">
        <button onClick={onTxn} className={ghostButtonClass}>
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

function RowStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <dt className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">{label}</dt>
      <dd className="tabular-nums text-[var(--color-text-primary)]">{value}</dd>
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
