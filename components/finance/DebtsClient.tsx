"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LayoutGrid, List, Layers, Search, ChevronDown, Sparkles } from "lucide-react";
import { DebtAccountFormCard } from "@/components/finance/DebtAccountFormCard";
import { DebtDetail, type DebtTxn } from "@/components/finance/DebtDetail";
import { DonutChart } from "@/components/finance/charts";
import { Modal } from "@/components/ui/Modal";
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
import { bucketDistribution, bucketAccentVar } from "@/lib/finance/insights";
import type { ExtraPaymentInsight } from "@/lib/finance/optimization";
import { DebtTypeIcon } from "@/components/finance/DebtTypeIcon";
import { formatUsd, formatPercent, utilization, payoffProgress } from "@/lib/finance/derive";
import { labelClass, primaryButtonClass } from "@/components/finance/formStyles";

type DebtView = "card" | "list" | "category";
const VIEW_KEY = "nzx.debts.view";
const SORT_KEY = "nzx.debts.sort";
const CARD_GRID = "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3";

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
  /** Per-debt transaction lists for the detail modal (keyed by debt id). */
  txnsByDebt: Record<string, DebtTxn[]>;
  /** Optional computed "put extra here to save interest" insight for the rail. */
  insight: ExtraPaymentInsight | null;
}

type Mode = { kind: "list" } | { kind: "create" } | { kind: "detail"; id: string };

export function DebtsClient({ debts, recent, txnsByDebt, insight }: Props) {
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const toList = useCallback(() => setMode({ kind: "list" }), []);
  const open = useCallback((debt: Debt) => setMode({ kind: "detail", id: debt.id }), []);
  // Resolve the detail debt from the live `debts` prop so the modal reflects balance/txn changes
  // after each action; if it's archived away, `detailDebt` goes null and the modal closes.
  const detailDebt = mode.kind === "detail" ? (debts.find((d) => d.id === mode.id) ?? null) : null;

  const totalBalance = debts.reduce((sum, d) => sum + Number(d.balance), 0);
  const totalMin = debts.reduce((sum, d) => sum + Number(d.min_payment), 0);

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<DebtType | "all">("all");
  const [sort, setSort] = useState<DebtSort>("balance_desc");
  const [view, setView] = useState<DebtView>("card");

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

  const presentTypes = useMemo(() => DEBT_TYPES.filter((t) => debts.some((d) => d.type === t)), [debts]);
  const visibleDebts = useMemo(
    () => filterAndSortDebts(debts, { query, type: typeFilter, sort }),
    [debts, query, typeFilter, sort],
  );

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header — total liability + account/minimums stats (debt v2 reference) */}
      <header className="mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-[var(--color-border-subtle)] pb-6">
        <h1 className="sr-only">Your debts</h1>
        <div>
          <p className={labelClass}>// total liability</p>
          <p className="mt-1 font-sans text-4xl font-medium tabular-nums text-[var(--color-text-primary)]">
            {formatUsd(totalBalance)}
          </p>
        </div>
        <div className="flex items-end gap-8">
          <div className="text-right">
            <p className={labelClass}>Active accounts</p>
            <p className="mt-1 font-sans text-2xl font-medium tabular-nums text-[var(--color-text-primary)]">
              {debts.length}
            </p>
          </div>
          <div className="text-right">
            <p className={labelClass}>Min. payments / mo</p>
            <p className="mt-1 font-sans text-2xl font-medium tabular-nums text-[var(--color-text-primary)]">
              {formatUsd(totalMin)}
            </p>
          </div>
          <button onClick={() => setMode({ kind: "create" })} className={primaryButtonClass}>
            New debt
          </button>
        </div>
      </header>

      <Modal open={mode.kind === "create"} onClose={toList} label="New debt">
        {mode.kind === "create" ? <DebtAccountFormCard onDone={toList} onCancel={toList} /> : null}
      </Modal>
      <Modal open={detailDebt != null} onClose={toList} label="Debt details" size="2xl">
        {detailDebt ? (
          <DebtDetail debt={detailDebt} txns={txnsByDebt[detailDebt.id] ?? []} onClose={toList} />
        ) : null}
      </Modal>

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

          <div className="lg:grid lg:grid-cols-[1fr_19rem] lg:items-start lg:gap-6">
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
                    <DebtRow key={debt.id} debt={debt} onOpen={() => open(debt)} />
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
                          <DebtCard key={debt.id} debt={debt} onOpen={() => open(debt)} />
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              ) : (
                <ul aria-label="Debts" className={CARD_GRID}>
                  {visibleDebts.map((debt) => (
                    <DebtCard key={debt.id} debt={debt} onOpen={() => open(debt)} />
                  ))}
                </ul>
              )}
            </div>

            <DebtRail debts={debts} insight={insight} />
          </div>

          <ActivityCard recent={recent} />
        </>
      )}
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

/** Right rail: category donut + per-bucket totals, then the optimization insight. */
function DebtRail({ debts, insight }: { debts: Debt[]; insight: ExtraPaymentInsight | null }) {
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
  const top = slices[0];
  if (!top) return null;

  return (
    <div className="mt-6 space-y-4 lg:mt-0">
      <aside
        aria-label="Debt by category"
        className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5"
      >
        <p className={labelClass}>// by category</p>
        <div className="mt-4">
          <DonutChart
            ariaLabel="Debt by category"
            centerLabel={top.label}
            centerValue={`${Math.round(top.pct * 100)}%`}
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
              <span className="shrink-0 tabular-nums text-[var(--color-text-primary)]">{formatUsd(s.total)}</span>
            </li>
          ))}
        </ul>
      </aside>

      {insight ? (
        <aside
          aria-label="Optimization insight"
          className="rounded-[var(--radius-card)] border border-[var(--color-accent-emerald)]/40 bg-[color-mix(in_oklab,var(--color-accent-emerald),transparent_92%)] p-5"
        >
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-accent-emerald)]">
            <Sparkles className="size-3.5" aria-hidden />
            Optimization insight
          </p>
          <p className="mt-3 font-sans text-sm leading-relaxed text-[var(--color-text-secondary)]">
            Allocating an extra{" "}
            <span className="font-medium text-[var(--color-text-primary)]">{formatUsd(insight.extra)}/mo</span> to your{" "}
            <span className="font-medium text-[var(--color-text-primary)]">{insight.debtName}</span> saves{" "}
            <span className="font-medium text-[var(--color-accent-emerald)]">{formatUsd(insight.interestSaved)}</span> in
            interest.
          </p>
        </aside>
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
  // One sharp control height shared across the toolbar (stitch reference).
  const ctrl =
    "h-9 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] font-mono text-[12px] text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-text-primary)]";
  return (
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
          placeholder="Search accounts…"
          className={`${ctrl} w-full pl-9 pr-3 placeholder:text-[var(--color-text-muted)]`}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative shrink-0">
          <select
            value={typeFilter}
            onChange={(e) => onTypeFilter(e.target.value as DebtType | "all")}
            aria-label="Filter by type"
            className={`${ctrl} appearance-none pl-3 pr-8`}
          >
            <option value="all">All types</option>
            {presentTypes.map((t) => (
              <option key={t} value={t}>
                {DEBT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--color-text-muted)]" aria-hidden />
        </div>

        <div className="relative shrink-0">
          <select
            value={sort}
            onChange={(e) => onSort(e.target.value as DebtSort)}
            aria-label="Sort debts"
            className={`${ctrl} appearance-none pl-3 pr-8`}
          >
            {DEBT_SORTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--color-text-muted)]" aria-hidden />
        </div>

        <div className="flex h-9 shrink-0 items-center rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] p-0.5">
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

/** Adaptive 2×2 metrics for the card face, matching the debt v2 reference. */
function cardStats(debt: Debt): { label: string; value: string }[] {
  const balance = Number(debt.balance);
  const isRevolving = debt.type === "credit_card";
  const util = utilization(balance, debt.credit_limit === null ? null : Number(debt.credit_limit));
  const progress = payoffProgress(balance, debt.original_balance === null ? null : Number(debt.original_balance));
  return [
    { label: isRevolving ? "Balance" : "Principal", value: formatUsd(balance) },
    { label: "APR", value: formatPercent(Number(debt.apr)) },
    { label: "Min pay", value: formatUsd(Number(debt.min_payment)) },
    isRevolving
      ? { label: "Util", value: util === null ? "—" : `${Math.round(util * 100)}%` }
      : { label: "Progress", value: progress === null ? "—" : `${Math.round(progress * 100)}%` },
  ];
}

/** The bar at the card foot: utilization (revolving) or payoff progress (amortizing). */
function cardBar(debt: Debt): { pct: number; tone: string } | null {
  const balance = Number(debt.balance);
  if (debt.type === "credit_card") {
    const util = utilization(balance, debt.credit_limit === null ? null : Number(debt.credit_limit));
    if (util === null) return null;
    const tone = util > 0.7 ? "--color-accent-red" : util > 0.3 ? "--color-accent-amber" : "--color-accent-emerald";
    return { pct: util, tone };
  }
  const progress = payoffProgress(balance, debt.original_balance === null ? null : Number(debt.original_balance));
  if (progress === null) return null;
  return { pct: progress, tone: "--color-accent-emerald" };
}

function DebtCard({ debt, onOpen }: { debt: Debt; onOpen: () => void }) {
  const accent = bucketAccentVar(debt.type);
  const stats = cardStats(debt);
  const bar = cardBar(debt);
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${debt.name}`}
        className="group relative w-full overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5 pl-6 text-left transition-colors hover:border-[var(--color-border-strong)]"
      >
        <span aria-hidden className="absolute left-0 top-0 h-full w-1" style={{ background: `var(${accent})` }} />
        {/* Whole card is the button — no external-link affordance needed. */}
        <p className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: `var(${accent})` }}>
          {DEBT_BUCKET_LABELS[typeBucket(debt.type)]}
        </p>
        <p className="mt-1 font-sans text-base font-medium break-words text-[var(--color-text-primary)]">
          {debt.name}
        </p>

        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 font-mono text-[11px]">
          {stats.map((s) => (
            <div key={s.label}>
              <dt className="uppercase tracking-[0.14em] text-[var(--color-text-muted)]">{s.label}</dt>
              <dd className="mt-0.5 text-sm tabular-nums text-[var(--color-text-primary)]">{s.value}</dd>
            </div>
          ))}
        </dl>

        {bar ? (
          <div className="mt-5 h-1 w-full overflow-hidden rounded-full bg-[var(--color-elevated)]">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.round(bar.pct * 100)}%`, background: `var(${bar.tone})` }}
            />
          </div>
        ) : null}
      </button>
    </li>
  );
}

function DebtRow({ debt, onOpen }: { debt: Debt; onOpen: () => void }) {
  const util = utilization(Number(debt.balance), debt.credit_limit === null ? null : Number(debt.credit_limit));
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${debt.name}`}
        className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 text-left transition-colors hover:bg-[var(--color-elevated)]"
      >
        <span className="shrink-0 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] p-2 text-[var(--color-text-secondary)]">
          <DebtTypeIcon type={debt.type} className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-sans text-sm font-medium text-[var(--color-text-primary)]">{debt.name}</p>
          <p className="truncate font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: `var(${bucketAccentVar(debt.type)})` }}>
            {DEBT_BUCKET_LABELS[typeBucket(debt.type)]}
          </p>
        </div>
        <dl className="flex shrink-0 items-center gap-x-5 font-mono text-[11px] text-[var(--color-text-secondary)]">
          <RowStat label="Bal" value={formatUsd(Number(debt.balance))} />
          <RowStat label="APR" value={formatPercent(Number(debt.apr))} />
          <RowStat label="Min" value={formatUsd(Number(debt.min_payment))} />
          <RowStat label="Util" value={util === null ? "—" : `${Math.round(util * 100)}%`} />
        </dl>
      </button>
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
              style={{ color: t.kind === "payment" ? "var(--color-accent-emerald)" : "var(--color-text-primary)" }}
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
