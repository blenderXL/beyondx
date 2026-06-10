"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Plus, ListChecks, Sparkles, ArrowRight } from "lucide-react";
import { StatCard } from "@/components/layout/StatCard";
import { togglePaid, toggleSavingsPaid } from "@/app/(app)/actions";
import { INITIAL_FINANCE_STATE } from "@/lib/finance/actionState";
import { formatUsd } from "@/lib/finance/derive";

export interface AgendaItem {
  kind: "expense" | "debt" | "savings";
  id: string;
  name: string;
  amount: number;
  dueDay: number | null;
}

interface Props {
  greetingName: string;
  billingMonth: string;
  totalDebt: number;
  totalMin: number;
  payoffMonths: number | null;
  interestSaved: number | null;
  income: number;
  outflow: number;
  offerings: number;
  leftover: number;
  subscriptionTotal: number;
  nextInflow: { amount: number; inDays: number } | null;
  agenda: AgendaItem[];
}

const labelMono = "font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]";

function payoffLabel(months: number | null): string {
  if (months == null || months <= 0) return "—";
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + months, 1);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function ordinal(day: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = day % 100;
  return `${day}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

export function DashboardClient(props: Props) {
  const { greetingName, agenda, income } = props;
  const committedPct = income > 0 ? Math.min(1, props.outflow / income) : 0;
  const subsPct = income > 0 ? Math.min(1, props.subscriptionTotal / income) : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-16">
      {/* Hero */}
      <header>
        <p className={labelMono}>// dashboard</p>
        <h1 className="mt-3 font-sans text-3xl font-medium leading-tight text-[var(--color-text-primary)]">
          Welcome back, {greetingName}
          <span aria-hidden className="ml-1">👋</span>
        </h1>
        <p className="mt-2 font-mono text-xs text-[var(--color-text-secondary)]">
          Your debts, bills, and payoff schedule at a glance.
        </p>
      </header>

      {/* Headline stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total debt"
          accentVar="--color-accent-red"
          value={props.totalDebt > 0 ? formatUsd(props.totalDebt) : "—"}
          hint={props.totalDebt > 0 ? "across all accounts" : "add your debts"}
        />
        <StatCard
          label="Monthly minimums"
          accentVar="--color-accent-amber"
          value={props.totalMin > 0 ? formatUsd(props.totalMin) : "—"}
          hint="auto-summed from debts"
        />
        <StatCard
          label="Payoff date"
          accentVar="--color-accent-emerald"
          value={payoffLabel(props.payoffMonths)}
          hint={props.payoffMonths != null ? "at your chosen pace" : "set a budget on the planner"}
        />
        <StatCard
          label="Interest saved"
          accentVar="--color-accent-blue"
          value={props.interestSaved != null ? formatUsd(props.interestSaved) : "—"}
          hint="vs. minimums-only"
        />
      </div>

      {/* This month: targets + quick stats — surfaced above the agenda + assistant insight. */}
      <div className="grid gap-6 lg:grid-cols-12">
        <section className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-6 lg:col-span-6">
          <h3 className="mb-6 font-sans text-base font-medium text-[var(--color-text-primary)]">This month</h3>
          <div className="space-y-6">
            <TargetBar label="Budget committed" current={props.outflow} total={income} pct={committedPct} accent="--color-accent-emerald" />
            <TargetBar label="Subscriptions" current={props.subscriptionTotal} total={income} pct={subsPct} accent="--color-accent-pink" />
          </div>
        </section>

        <div className="grid grid-cols-2 gap-4 lg:col-span-6">
          <div className="flex flex-col justify-center rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-6">
            <p className={labelMono}>Available this month</p>
            <p
              className="mt-2 font-sans text-2xl font-medium tabular-nums"
              style={{ color: props.leftover < 0 ? "var(--color-accent-red)" : "var(--color-text-primary)" }}
            >
              {formatUsd(props.leftover)}
            </p>
            <p className="mt-1 font-mono text-[10px] text-[var(--color-text-muted)]">income − outflow</p>
          </div>
          <div className="flex flex-col justify-center rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-6">
            <p className={labelMono}>Est. next inflow</p>
            <p className="mt-2 font-sans text-2xl font-medium tabular-nums text-[var(--color-text-primary)]">
              {props.nextInflow ? formatUsd(props.nextInflow.amount) : "—"}
            </p>
            <p className="mt-1 font-mono text-[10px] text-[var(--color-text-muted)]">
              {props.nextInflow
                ? props.nextInflow.inDays === 0
                  ? "today"
                  : `in ${props.nextInflow.inDays} day${props.nextInflow.inDays === 1 ? "" : "s"}`
                : "add an income source"}
            </p>
          </div>
        </div>
      </div>

      {/* Agenda + AI insight */}
      <div className="grid gap-6 lg:grid-cols-12">
        <section className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-6 lg:col-span-8">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-sans text-lg font-medium text-[var(--color-text-primary)]">
              <ListChecks className="size-5 text-[var(--color-accent-emerald)]" aria-hidden />
              Today&apos;s agenda
            </h2>
            <Link
              href="/app/expenses"
              className="flex items-center gap-1 font-mono text-[11px] text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
            >
              View all <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
          {agenda.length === 0 ? (
            <p className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-strong)] p-8 text-center font-mono text-sm text-[var(--color-text-muted)]">
              // nothing left to pay this month — you&apos;re all caught up
            </p>
          ) : (
            <ul aria-label="Today's agenda" className="space-y-3">
              {agenda.slice(0, 6).map((item) => (
                <AgendaRow key={`${item.kind}:${item.id}`} item={item} billingMonth={props.billingMonth} />
              ))}
            </ul>
          )}
        </section>

        {/* AI insight — placeholder until v1.2 */}
        <section className="relative flex flex-col justify-between overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-6 lg:col-span-4">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "20px 20px" }}
          />
          <div className="relative">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="size-4 text-[var(--color-accent-emerald)]" aria-hidden />
              <h3 className={labelMono}>Assistant insight</h3>
            </div>
            <p className="font-sans text-sm leading-relaxed text-[var(--color-text-secondary)]">
              Personalized payoff nudges land here when the AI assistant ships.
            </p>
          </div>
          <p className="relative mt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-accent-purple)]">
            // pro · coming in v1.2
          </p>
        </section>
      </div>

      {/* Quick add */}
      <Link
        href="/app/expenses?new=1"
        aria-label="Add an expense"
        className="fixed bottom-8 right-8 z-40 flex size-14 items-center justify-center rounded-full bg-[var(--color-accent-emerald)] text-[var(--color-canvas)] shadow-lg transition-transform hover:scale-105"
      >
        <Plus className="size-7" aria-hidden />
      </Link>
    </div>
  );
}

function TargetBar({
  label,
  current,
  total,
  pct,
  accent,
}: {
  label: string;
  current: number;
  total: number;
  pct: number;
  accent: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-end justify-between">
        <span className="font-mono text-[11px] text-[var(--color-text-secondary)]">{label}</span>
        <span className="font-mono text-[11px] tabular-nums text-[var(--color-text-primary)]">
          {formatUsd(current)} / {formatUsd(total)}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-elevated)]">
        <div className="h-full rounded-full" style={{ width: `${Math.round(pct * 100)}%`, background: `var(${accent})` }} />
      </div>
    </div>
  );
}

function AgendaRow({ item, billingMonth }: { item: AgendaItem; billingMonth: string }) {
  return (
    <li className="flex items-center justify-between gap-4 rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-canvas)] px-4 py-3">
      <div className="min-w-0">
        <p className="truncate font-sans text-sm font-medium text-[var(--color-text-primary)]">{item.name}</p>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
          {item.kind === "savings" ? "savings goal" : item.dueDay ? `due ${ordinal(item.dueDay)}` : "no due day"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-4">
        <p className="font-mono text-sm tabular-nums text-[var(--color-text-primary)]">{formatUsd(item.amount)}</p>
        <PayButton item={item} billingMonth={billingMonth} />
      </div>
    </li>
  );
}

const payBtnClass =
  "rounded-md bg-[var(--color-text-primary)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--color-canvas)] transition-opacity hover:opacity-90 disabled:opacity-50";

/** Pay action — debt-linked and plain expenses + debt bills go through togglePaid; savings
 * contributions through toggleSavingsPaid. Marking paid drops the row on revalidation. */
function PayButton({ item, billingMonth }: { item: AgendaItem; billingMonth: string }) {
  if (item.kind === "savings") return <SavingsPay item={item} billingMonth={billingMonth} />;
  return <ExpenseDebtPay item={item} billingMonth={billingMonth} />;
}

function ExpenseDebtPay({ item, billingMonth }: { item: AgendaItem; billingMonth: string }) {
  const [, formAction, pending] = useActionState(togglePaid, INITIAL_FINANCE_STATE);
  return (
    <form action={formAction}>
      <input type="hidden" name="kind" value={item.kind} />
      <input type="hidden" name="item_id" value={item.id} />
      <input type="hidden" name="billing_month" value={billingMonth} />
      <input type="hidden" name="amount" value={item.amount} />
      <input type="hidden" name="checked" value="on" />
      <button type="submit" disabled={pending} className={payBtnClass} aria-label={`Pay ${item.name}`}>
        {pending ? "…" : "Pay"}
      </button>
    </form>
  );
}

function SavingsPay({ item, billingMonth }: { item: AgendaItem; billingMonth: string }) {
  const [, formAction, pending] = useActionState(toggleSavingsPaid, INITIAL_FINANCE_STATE);
  return (
    <form action={formAction}>
      <input type="hidden" name="item_id" value={item.id} />
      <input type="hidden" name="billing_month" value={billingMonth} />
      <input type="hidden" name="amount" value={item.amount} />
      <input type="hidden" name="checked" value="on" />
      <button type="submit" disabled={pending} className={payBtnClass} aria-label={`Contribute to ${item.name}`}>
        {pending ? "…" : "Save"}
      </button>
    </form>
  );
}
