"use client";

import { useActionState, useCallback, useEffect, useMemo, useState } from "react";
import { LayoutGrid, List, Layers, Search } from "lucide-react";
import { DebtAccountFormCard } from "@/components/finance/DebtAccountFormCard";
import { TransactionForm } from "@/components/finance/TransactionForm";
import { DonutChart } from "@/components/finance/charts";
import { archiveDebt } from "@/app/(app)/actions";
import { INITIAL_FINANCE_STATE } from "@/lib/finance/actionState";
import {
  DEBT_TYPE_LABELS,
  DEBT_TYPES,
  DEBT_BUCKETS,
  DEBT_BUCKET_LABELS,
  typeBucket,
  type Debt,
  type DebtType,
  type DebtBucket,
  type TransactionKind,
} from "@/lib/finance/types";
import { filterAndSortDebts, DEBT_SORTS, type DebtSort } from "@/lib/finance/debtsView";
import { bucketDistribution } from "@/lib/finance/insights";
import { cardMetricsFor } from "@/lib/finance/cardMetrics";
import { DebtTypeIcon } from "@/components/finance/DebtTypeIcon";
import { formatUsd, formatPercent, utilization, payoffProgress, formatDueDate } from "@/lib/finance/derive";
import {
  inputClass,
  labelClass,
  primaryButtonClass,
  ghostButtonClass,
  errorClass,
} from "@/components/finance/formStyles";

type DebtView = "card" | "list" | "category";
const VIEW_KEY = "nzx.debts.view";
const SORT_KEY = "nzx.debts.sort";
const CARD_GRID = "grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3";

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
      if (v === "card" || v === "list" || v === "category") setView(v);
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
  const presentTypes = useMemo(() => DEBT_TYPES.filter((t) => debts.some((d) => d.type === t)), [debts]);
  const visibleDebts = useMemo(
    () => filterAndSortDebts(debts, { query, type: typeFilter, sort }),
    [debts, query, typeFilter, sort],
  );

  const openEdit = useCallback((debt: Debt) => setMode({ kind: "edit", debt }), []);
  const openTxn = useCallback((debt: Debt) => setMode({ kind: "txn", debt }), []);

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className={labelClass}>// debts</p>
          <h1 className="mt-2 font-sans text-3xl font-medium text-[var(--color-text-primary)]">Your debts</h1>
        </div>
        {mode.kind === "list" ? (
          <button onClick={() => setMode({ kind: "create" })} className={primaryButtonClass}>
            New debt
          </button>
        ) : null}
      </header>

      {mode.kind === "create" ? <DebtAccountFormCard onDone={toList} onCancel={toList} /> : null}
      {mode.kind === "edit" ? <DebtAccountFormCard debt={mode.debt} onDone={toList} onCancel={toList} /> : null}
      {mode.kind === "txn" ? <TransactionForm debt={mode.debt} onDone={toList} onCancel={toList} /> : null}

      {mode.kind === "list" ? (
        <>
          {/* Compact summary strip (reclaims the vertical space the three large cards used). */}
          <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-5 py-3">
            <SummaryStat label="Total balance" value={formatUsd(totalBalance)} accentVar="--color-accent-red" />
            <SummaryStat label="Active" value={String(debts.length)} accentVar="--color-accent-blue" />
            <SummaryStat label="Min. payments / mo" value={formatUsd(totalMin)} accentVar="--color-accent-amber" />
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

              <div className="lg:grid lg:grid-cols-[1fr_17rem] lg:items-start lg:gap-6">
                <div>
                  {visibleDebts.length === 0 ? (
                    <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-strong)] p-10 text-center">
                      <p className="font-mono text-sm text-[var(--color-text-muted)]">
                        // no debts match your search or filter
                      </p>
                    </div>
                  ) : view === "list" ? (
                    <ul
                      aria-label="Debts"
                      className="divide-y divide-[var(--color-border-subtle)] overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)]"
                    >
                      {visibleDebts.map((debt) => (
                        <DebtRow key={debt.id} debt={debt} onEdit={() => openEdit(debt)} onTxn={() => openTxn(debt)} />
                      ))}
                    </ul>
                  ) : view === "category" ? (
                    <div className="space-y-8">
                      {groupByBucket(visibleDebts).map((g) => (
                        <section key={g.bucket} aria-label={g.label}>
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <p className={labelClass}>// {g.label.toLowerCase()}</p>
                            <p className="font-mono text-[11px] tabular-nums text-[var(--color-text-muted)]">
                              {g.debts.length} · {formatUsd(g.debts.reduce((s, d) => s + Number(d.balance), 0))}
                            </p>
                          </div>
                          <ul aria-label={g.label} className={CARD_GRID}>
                            {g.debts.map((debt) => (
                              <DebtCard key={debt.id} debt={debt} onEdit={() => openEdit(debt)} onTxn={() => openTxn(debt)} />
                            ))}
                          </ul>
                        </section>
                      ))}
                    </div>
                  ) : (
                    <ul aria-label="Debts" className={CARD_GRID}>
                      {visibleDebts.map((debt) => (
                        <DebtCard key={debt.id} debt={debt} onEdit={() => openEdit(debt)} onTxn={() => openTxn(debt)} />
                      ))}
                    </ul>
                  )}
                </div>

                <DebtRail debts={debts} totalBalance={totalBalance} />
              </div>
            </>
          )}

          <ActivityCard recent={recent} />
        </>
      ) : null}
    </div>
  );
}

function SummaryStat({ label, value, accentVar }: { label: string; value: string; accentVar: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="size-2 shrink-0 rounded-full" style={{ background: `var(${accentVar})` }} aria-hidden />
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">{label}</span>
      <span className="font-sans text-sm font-medium tabular-nums text-[var(--color-text-primary)]">{value}</span>
    </div>
  );
}

function groupByBucket(debts: Debt[]): { bucket: DebtBucket; label: string; debts: Debt[] }[] {
  return DEBT_BUCKETS.map((bucket) => ({
    bucket,
    label: DEBT_BUCKET_LABELS[bucket],
    debts: debts.filter((d) => typeBucket(d.type) === bucket),
  })).filter((g) => g.debts.length > 0);
}

/** Right-rail category breakdown (donut + per-bucket totals). Portfolio-wide (ignores filters). */
function DebtRail({ debts, totalBalance }: { debts: Debt[]; totalBalance: number }) {
  const slices = useMemo(
    () =>
      bucketDistribution(
        debts.map((d) => ({
          type: d.type,
          balance: Number(d.balance),
          apr: Number(d.apr),
          credit_limit: d.credit_limit === null ? null : Number(d.credit_limit),
        })),
      ),
    [debts],
  );
  if (slices.length === 0) return null;

  return (
    <aside
      aria-label="Debt by category"
      className="mt-6 rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5 lg:mt-0"
    >
      <p className={labelClass}>// by category</p>
      <div className="mt-4">
        <DonutChart
          ariaLabel="Debt by category"
          centerLabel="Total"
          centerValue={formatUsd(totalBalance)}
          slices={slices.map((s) => ({ label: s.label, value: s.total, accentVar: s.accentVar }))}
        />
      </div>
      <ul className="mt-5 space-y-2.5">
        {slices.map((s) => (
          <li key={s.bucket} className="flex items-center justify-between gap-3 font-mono text-[11px]">
            <span className="flex min-w-0 items-center gap-2 text-[var(--color-text-secondary)]">
              <span className="size-2 shrink-0 rounded-full" style={{ background: `var(${s.accentVar})` }} aria-hidden />
              <span className="truncate">{s.label}</span>
            </span>
            <span className="shrink-0 tabular-nums text-[var(--color-text-primary)]">
              {formatUsd(s.total)} · {Math.round(s.pct * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </aside>
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
  // `inputClass` carries `w-full`; force auto width on the selects (!important beats it by
  // CSS order) so the controls sit compactly on one line instead of stacking full-width.
  const selectClass = `${inputClass} mt-0 h-10 !w-auto max-w-[12rem]`;
  return (
    // Search grows; the filter/sort/view controls stay grouped on the same row. Wraps to a
    // second row only below `sm`, keeping the debt cards close to the top.
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
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

      <div className="flex items-center gap-3">
        <select
          value={typeFilter}
          onChange={(e) => onTypeFilter(e.target.value as DebtType | "all")}
          aria-label="Filter by type"
          className={selectClass}
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
          className={selectClass}
        >
          {DEBT_SORTS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <div className="flex h-10 shrink-0 items-center rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] p-0.5">
          {(
            [
              { v: "card" as const, Icon: LayoutGrid, label: "Card view" },
              { v: "list" as const, Icon: List, label: "List view" },
              { v: "category" as const, Icon: Layers, label: "Category view" },
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
  const metrics = cardMetricsFor(debt);
  const progress = payoffProgress(
    Number(debt.balance),
    debt.original_balance === null ? null : Number(debt.original_balance),
  );

  return (
    <li className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 shrink-0 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] p-1.5 text-[var(--color-text-secondary)]">
            <DebtTypeIcon type={debt.type} className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="font-sans text-sm font-medium break-words text-[var(--color-text-primary)]">{debt.name}</p>
            <p className="mt-0.5 font-mono text-[10px] tracking-[0.16em] break-words text-[var(--color-text-muted)] uppercase">
              {DEBT_TYPE_LABELS[debt.type]}
              {debt.issuer ? ` · ${debt.issuer}` : ""}
            </p>
          </div>
        </div>
        <p className="shrink-0 font-sans text-xl font-medium tabular-nums text-[var(--color-text-primary)]">
          {formatUsd(Number(debt.balance))}
        </p>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-y-2 font-mono text-[11px] text-[var(--color-text-secondary)]">
        {metrics.map((m) => (
          <Stat key={m.label} label={m.label} value={m.value} />
        ))}
      </dl>

      {progress !== null ? (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-elevated)]">
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.round(progress * 100)}%`, background: "var(--color-accent-emerald)" }}
          />
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
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
                color: t.kind === "payment" ? "var(--color-accent-emerald)" : "var(--color-text-primary)",
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
