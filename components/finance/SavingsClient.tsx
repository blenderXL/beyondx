"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { PiggyBank } from "lucide-react";
import { StatCard } from "@/components/layout/StatCard";
import {
  createSavingsGoal,
  updateSavingsGoal,
  archiveSavingsGoal,
  addContribution,
} from "@/app/(app)/actions";
import { INITIAL_FINANCE_STATE } from "@/lib/finance/actionState";
import { SAVINGS_TYPES, SAVINGS_TYPE_LABELS, type SavingsGoal } from "@/lib/finance/types";
import { formatUsd } from "@/lib/finance/derive";
import { SparkArea } from "@/components/finance/charts";
import { Modal } from "@/components/ui/Modal";
import { FieldHint } from "@/components/finance/FieldHint";
import { SAVINGS_HINTS } from "@/lib/finance/fieldHints";
import {
  inputClass,
  labelClass,
  primaryButtonClass,
  ghostButtonClass,
  errorClass,
} from "@/components/finance/formStyles";

/** Inline-editor styles for the on-card quick-edit (mirrors the expense card). */
const inlineFieldClass =
  "mt-1 h-9 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] px-2 font-mono text-[12px] text-[var(--color-text-primary)] tabular-nums outline-none transition-colors focus:border-[var(--color-text-primary)]";
const inlineLabelClass = "font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]";

type RecurringKind = "none" | "fixed" | "percent";

function recurringKindOf(g: SavingsGoal): RecurringKind {
  if (g.pct_of_income != null && Number(g.pct_of_income) > 0) return "percent";
  if (g.monthly_contribution != null && Number(g.monthly_contribution) > 0) return "fixed";
  return "none";
}

function potProgress(g: SavingsGoal): number | null {
  if (g.target_amount === null || Number(g.target_amount) <= 0) return null;
  return Math.max(0, Math.min(1, Number(g.current_amount) / Number(g.target_amount)));
}

function SavingsForm({ goal, onDone, onCancel }: { goal?: SavingsGoal; onDone: () => void; onCancel: () => void }) {
  const editing = Boolean(goal);
  const [state, formAction, pending] = useActionState(
    editing ? updateSavingsGoal : createSavingsGoal,
    INITIAL_FINANCE_STATE,
  );
  const [recurring, setRecurring] = useState<RecurringKind>(goal ? recurringKindOf(goal) : "none");
  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form
      action={formAction}
      className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-6"
    >
      <p className={labelClass}>// {editing ? "edit pot" : "new pot"}</p>
      <h2 className="mt-2 mb-6 font-sans text-xl font-medium text-[var(--color-text-primary)]">
        {editing ? goal!.name : "Add a savings pot"}
      </h2>
      {editing ? <input type="hidden" name="id" value={goal!.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className={labelClass}>
            Name
            <FieldHint text={SAVINGS_HINTS.name} label="name" />
          </span>
          <input
            type="text"
            name="name"
            aria-label="Name"
            required
            maxLength={120}
            defaultValue={goal?.name}
            placeholder="Purge, Emergency fund…"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className={labelClass}>
            Type
            <FieldHint text={SAVINGS_HINTS.type} label="savings type" />
          </span>
          <select name="type" aria-label="Type" defaultValue={goal?.type ?? "general"} className={inputClass}>
            {SAVINGS_TYPES.map((t) => (
              <option key={t} value={t}>
                {SAVINGS_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={labelClass}>
            Current amount
            <FieldHint text={SAVINGS_HINTS.current_amount} label="current amount" />
          </span>
          <input
            type="text"
            inputMode="decimal"
            name="current_amount"
            aria-label="Current amount"
            defaultValue={goal?.current_amount ?? ""}
            placeholder="0.00"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className={labelClass}>
            Target (optional)
            <FieldHint text={SAVINGS_HINTS.target_amount} label="target" />
          </span>
          <input
            type="text"
            inputMode="decimal"
            name="target_amount"
            aria-label="Target"
            defaultValue={goal?.target_amount ?? ""}
            placeholder="0.00"
            className={inputClass}
          />
        </label>

        {/* Recurring contribution: off, a fixed $ amount, or a percent of monthly income. */}
        <label className="block">
          <span className={labelClass}>
            Recurring contribution
            <FieldHint text={SAVINGS_HINTS.recurring} label="recurring contribution" />
          </span>
          <select
            name="recurring_kind"
            aria-label="Recurring contribution"
            value={recurring}
            onChange={(e) => setRecurring(e.target.value as RecurringKind)}
            className={inputClass}
          >
            <option value="none">None</option>
            <option value="fixed">Fixed amount</option>
            <option value="percent">% of income</option>
          </select>
        </label>

        {recurring === "fixed" ? (
          <label className="block">
            <span className={labelClass}>
              Monthly contribution
              <FieldHint text={SAVINGS_HINTS.monthly_contribution} label="monthly contribution" />
            </span>
            <input
              type="text"
              inputMode="decimal"
              name="monthly_contribution"
              aria-label="Monthly contribution"
              defaultValue={goal?.monthly_contribution ?? ""}
              placeholder="0.00"
              className={inputClass}
            />
          </label>
        ) : null}

        {recurring === "percent" ? (
          <label className="block">
            <span className={labelClass}>Percent of income</span>
            <input
              type="text"
              inputMode="decimal"
              name="pct_of_income"
              aria-label="Percent of income"
              defaultValue={goal?.pct_of_income ?? ""}
              placeholder="e.g. 10"
              className={inputClass}
            />
            <span className="mt-1 block font-mono text-[10px] text-[var(--color-text-muted)]">
              Shows on Expenses each month as that % of your total income.
            </span>
          </label>
        ) : null}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? "Saving…" : editing ? "Save pot" : "Add pot"}
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

type Mode = { kind: "list" } | { kind: "create" } | { kind: "detail"; id: string };

export function SavingsClient({
  goals,
  trajectory = [],
  months = [],
  trajectoryByGoal = {},
}: {
  goals: SavingsGoal[];
  trajectory?: number[];
  months?: string[];
  /** Per-pot cumulative-saved series (keyed by goal id) for the detail modal's progress graph. */
  trajectoryByGoal?: Record<string, number[]>;
}) {
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const toList = useCallback(() => setMode({ kind: "list" }), []);
  const open = useCallback((g: SavingsGoal) => setMode({ kind: "detail", id: g.id }), []);
  // Resolve the open pot from the live list so the modal reflects edits/contributions; if it's
  // archived away, detailGoal goes null and the modal closes itself.
  const detailGoal = mode.kind === "detail" ? (goals.find((g) => g.id === mode.id) ?? null) : null;
  const total = goals.reduce((sum, g) => sum + Number(g.current_amount), 0);
  const hasTrajectory = trajectory.some((v) => v > 0);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className={labelClass}>// savings</p>
          <h1 className="mt-2 font-sans text-3xl font-medium text-[var(--color-text-primary)]">
            Your savings pots
          </h1>
        </div>
        <button onClick={() => setMode({ kind: "create" })} className={primaryButtonClass}>
          New pot
        </button>
      </header>

      <Modal open={mode.kind === "create"} onClose={toList} label="New savings pot">
        {mode.kind === "create" ? <SavingsForm onDone={toList} onCancel={toList} /> : null}
      </Modal>
      <Modal open={detailGoal != null} onClose={toList} label="Savings pot details" size="4xl">
        {detailGoal ? (
          <SavingsDetail goal={detailGoal} trajectory={trajectoryByGoal[detailGoal.id] ?? []} months={months} onClose={toList} />
        ) : null}
      </Modal>

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <StatCard label="Pots" value={String(goals.length)} accentVar="--color-accent-emerald" />
        <StatCard label="Total saved" value={formatUsd(total)} accentVar="--color-accent-blue" />
      </div>

      {hasTrajectory ? (
        <section className="mb-8 rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5">
          <div className="flex items-baseline justify-between gap-4">
            <p className={labelClass}>// savings trajectory</p>
            <p className="font-mono text-[10px] tracking-[0.18em] text-[var(--color-text-muted)] uppercase">
              {months.length > 0 ? `${months[0]} → ${months[months.length - 1]}` : ""}
            </p>
          </div>
          <div className="mt-3">
            <SparkArea values={trajectory} accentVar="--color-accent-emerald" />
          </div>
        </section>
      ) : null}

      {goals.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-strong)] p-10 text-center">
          <p className="font-mono text-sm text-[var(--color-text-muted)]">
            // no pots yet — create one (like &quot;Purge&quot;) to start saving
          </p>
        </div>
      ) : (
        <ul aria-label="Savings pots" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {goals.map((goal) => (
            <SavingsCard key={goal.id} goal={goal} onOpen={() => open(goal)} />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Savings pot card. Click the dollar amount to quick-edit the current balance in place (the
 * unchanged fields ride along as hidden inputs so the validator gets a complete pot). Click
 * anywhere else on the card to open the detail modal (edit / contribute / archive / progress).
 */
function SavingsCard({ goal, onOpen }: { goal: SavingsGoal; onOpen: () => void }) {
  const [state, formAction, pending] = useActionState(updateSavingsGoal, INITIAL_FINANCE_STATE);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (state.ok) setEditing(false);
  }, [state.ok]);
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const progress = potProgress(goal);
  const recurring = recurringKindOf(goal);
  const recurringLabel =
    recurring === "fixed"
      ? `${formatUsd(Number(goal.monthly_contribution))}/mo`
      : recurring === "percent"
        ? `${Number(goal.pct_of_income)}% of income`
        : null;

  return (
    <li>
      <div
        onClick={onOpen}
        className="group relative cursor-pointer overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5 pl-6 transition-colors hover:border-[var(--color-border-strong)]"
      >
        <span aria-hidden className="absolute left-0 top-0 h-full w-1" style={{ background: "var(--color-accent-emerald)" }} />

        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden
              className="flex size-8 shrink-0 items-center justify-center rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-elevated)] text-[var(--color-accent-emerald)]"
            >
              <PiggyBank className="size-[18px]" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-sans text-base font-medium text-[var(--color-text-primary)]">{goal.name}</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                {SAVINGS_TYPE_LABELS[goal.type ?? "general"]}
              </p>
            </div>
          </div>
        </div>

        {/* Current amount: click to quick-edit the balance in place. */}
        {!editing ? (
          <button
            type="button"
            onClick={(e) => {
              stop(e);
              setEditing(true);
            }}
            aria-label={`Edit amount for ${goal.name}`}
            className="mt-3 flex items-baseline gap-1 font-sans tabular-nums transition-colors hover:text-[var(--color-accent-emerald)]"
          >
            <span className="text-sm text-[var(--color-text-muted)]">$</span>
            <span className="text-2xl font-medium text-[var(--color-text-primary)]">
              {formatUsd(Number(goal.current_amount)).replace(/^\$/, "")}
            </span>
          </button>
        ) : (
          <form action={formAction} onClick={stop} className="mt-3 flex items-end gap-2">
            <input type="hidden" name="id" value={goal.id} />
            <input type="hidden" name="name" value={goal.name} />
            <input type="hidden" name="type" value={goal.type ?? "general"} />
            <input type="hidden" name="target_amount" value={goal.target_amount ?? ""} />
            <input type="hidden" name="recurring_kind" value={recurring} />
            {recurring === "fixed" ? (
              <input type="hidden" name="monthly_contribution" value={goal.monthly_contribution ?? ""} />
            ) : null}
            {recurring === "percent" ? (
              <input type="hidden" name="pct_of_income" value={goal.pct_of_income ?? ""} />
            ) : null}
            <label className="flex-1">
              <span className={inlineLabelClass}>Current $</span>
              <input
                name="current_amount"
                inputMode="decimal"
                autoFocus
                defaultValue={String(goal.current_amount)}
                aria-label={`Amount for ${goal.name}`}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setEditing(false);
                }}
                className={inlineFieldClass}
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="flex h-9 shrink-0 items-center rounded-md bg-[var(--color-text-primary)] px-3 font-mono text-[10px] tracking-[0.18em] text-[var(--color-canvas)] uppercase transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {pending ? "…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="flex h-9 shrink-0 items-center rounded-md border border-[var(--color-border-strong)] px-3 font-mono text-[10px] tracking-[0.18em] text-[var(--color-text-muted)] uppercase transition-colors hover:text-[var(--color-text-primary)]"
            >
              Cancel
            </button>
          </form>
        )}

        {progress !== null ? (
          <div className="mt-4">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-elevated)]">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.round(progress * 100)}%`, background: "var(--color-accent-emerald)" }}
              />
            </div>
            <p className="mt-1 flex items-center justify-between font-mono text-[10px] text-[var(--color-text-muted)]">
              <span>{Math.round(progress * 100)}% of target</span>
              <span className="tabular-nums">{formatUsd(Number(goal.target_amount))}</span>
            </p>
          </div>
        ) : goal.target_amount !== null ? (
          <p className="mt-3 font-mono text-[11px] text-[var(--color-text-muted)]">
            target {formatUsd(Number(goal.target_amount))}
          </p>
        ) : null}

        {recurringLabel ? (
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
            ↻ {recurringLabel}
          </p>
        ) : null}

        {state.error ? (
          <p role="alert" className={`mt-2 ${errorClass}`}>
            // {state.error}
          </p>
        ) : null}
      </div>
    </li>
  );
}

/**
 * The pot "card detail" — opened by clicking a card. Two-column on wide screens: edit the pot on
 * the left; its progress graph + contribute form on the right, with archive in the header.
 */
function SavingsDetail({
  goal,
  trajectory,
  months,
  onClose,
}: {
  goal: SavingsGoal;
  trajectory: number[];
  months: string[];
  onClose: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={labelClass}>// savings pot</p>
          <h2 className="mt-1 font-sans text-xl font-medium text-[var(--color-text-primary)]">{goal.name}</h2>
          <p className="mt-1 font-mono text-[11px] text-[var(--color-text-muted)]">
            Saved{" "}
            <span className="tabular-nums text-[var(--color-text-secondary)]">
              {formatUsd(Number(goal.current_amount))}
            </span>
          </p>
        </div>
        <ArchiveButton id={goal.id} name={goal.name} />
      </div>

      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
        {/* Keyed by updated_at so the edit form's defaults refresh after a contribution changes the balance. */}
        <SavingsForm key={goal.updated_at} goal={goal} onDone={onClose} onCancel={onClose} />

        <div className="mt-6 space-y-6 lg:mt-0">
          {trajectory.some((v) => v > 0) ? (
            <section className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-4">
              <div className="flex items-baseline justify-between gap-4">
                <p className={labelClass}>// progress</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                  {months.length > 0 ? `${months[0]} → ${months[months.length - 1]}` : ""}
                </p>
              </div>
              <div className="mt-3">
                <SparkArea values={trajectory} accentVar="--color-accent-emerald" height={96} />
              </div>
            </section>
          ) : null}

          <ContributionForm goal={goal} onDone={() => {}} onCancel={onClose} />
        </div>
      </div>
    </div>
  );
}

/** Record a deposit into one pot — bumps its balance and feeds the trajectory. */
function ContributionForm({ goal, onDone, onCancel }: { goal: SavingsGoal; onDone: () => void; onCancel: () => void }) {
  const [state, formAction, pending] = useActionState(addContribution, INITIAL_FINANCE_STATE);
  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form
      action={formAction}
      className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-6"
    >
      <p className={labelClass}>// add contribution</p>
      <p className="mt-1 mb-5 font-mono text-[11px] text-[var(--color-text-muted)]">
        // current {formatUsd(Number(goal.current_amount))}
      </p>

      <input type="hidden" name="savings_goal_id" value={goal.id} />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Amount</span>
          <input
            type="text"
            inputMode="decimal"
            name="amount"
            aria-label="Contribution amount"
            required
            placeholder="0.00"
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Date</span>
          <input type="date" name="occurred_on" aria-label="Contribution date" className={inputClass} />
        </label>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? "Recording…" : "Record contribution"}
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

function ArchiveButton({ id, name }: { id: string; name: string }) {
  const [state, formAction] = useActionState(archiveSavingsGoal, INITIAL_FINANCE_STATE);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(`Archive "${name}"? It'll be hidden from your pots.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="flex h-9 items-center justify-center rounded-md px-3 font-mono text-[11px] tracking-[0.16em] text-[var(--color-text-muted)] uppercase transition-colors hover:text-[var(--color-accent-red)]"
      >
        Archive
      </button>
      {state.error ? <span role="alert" className={`ml-2 ${errorClass}`}>{state.error}</span> : null}
    </form>
  );
}
