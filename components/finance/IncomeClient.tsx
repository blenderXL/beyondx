"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { StatCard } from "@/components/layout/StatCard";
import { createIncome, updateIncome, archiveIncome } from "@/app/(app)/actions";
import { INITIAL_FINANCE_STATE } from "@/lib/finance/actionState";
import {
  INCOME_CADENCES,
  INCOME_CADENCE_LABELS,
  TITHE_MODES,
  type Income,
  type TitheMode,
} from "@/lib/finance/types";
import { formatUsd } from "@/lib/finance/derive";
import { FieldHint } from "@/components/finance/FieldHint";
import { INCOME_HINTS } from "@/lib/finance/fieldHints";
import {
  inputClass,
  labelClass,
  primaryButtonClass,
  ghostButtonClass,
  errorClass,
} from "@/components/finance/formStyles";

const TITHE_LABELS: Record<TitheMode, string> = {
  none: "No offering",
  percent: "Percent of paycheck",
  fixed: "Fixed amount",
};

function titheSummary(i: Income): string {
  if (i.tithe_mode === "percent") return `${i.tithe_value ?? 0}% offering`;
  if (i.tithe_mode === "fixed") return `${formatUsd(i.tithe_value ?? 0)} offering`;
  return "no offering";
}

function IncomeForm({ income, onDone, onCancel }: { income?: Income; onDone: () => void; onCancel: () => void }) {
  const editing = Boolean(income);
  const [state, formAction, pending] = useActionState(
    editing ? updateIncome : createIncome,
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
      <p className={labelClass}>// {editing ? "edit income" : "new income"}</p>
      <h2 className="mt-2 mb-6 font-sans text-xl font-medium text-[var(--color-text-primary)]">
        {editing ? income!.source : "Add an income source"}
      </h2>
      {editing ? <input type="hidden" name="id" value={income!.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className={labelClass}>
            Source
            <FieldHint text={INCOME_HINTS.source} label="source" />
          </span>
          <input
            type="text"
            name="source"
            aria-label="Source"
            required
            maxLength={120}
            defaultValue={income?.source}
            placeholder="Salary (1st), Salary (15th), Side gig…"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className={labelClass}>
            Amount
            <FieldHint text={INCOME_HINTS.amount} label="amount" />
          </span>
          <input
            type="text"
            inputMode="decimal"
            name="amount"
            aria-label="Amount"
            required
            defaultValue={income?.amount ?? ""}
            placeholder="0.00"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className={labelClass}>
            Pay frequency
            <FieldHint text={INCOME_HINTS.cadence} label="pay frequency" />
          </span>
          <select name="cadence" aria-label="Pay frequency" defaultValue={income?.cadence ?? "semimonthly"} className={inputClass}>
            {INCOME_CADENCES.map((c) => (
              <option key={c} value={c}>
                {INCOME_CADENCE_LABELS[c]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={labelClass}>
            Pay day (1–31)
            <FieldHint text={INCOME_HINTS.pay_day} label="pay day" />
          </span>
          <input
            type="number"
            name="pay_day"
            aria-label="Pay day (1–31)"
            min={1}
            max={31}
            step={1}
            defaultValue={income?.pay_day ?? ""}
            placeholder="1 or 15"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className={labelClass}>
            Offering / tithe
            <FieldHint text={INCOME_HINTS.tithe_mode} label="offering" />
          </span>
          <select name="tithe_mode" aria-label="Offering / tithe" defaultValue={income?.tithe_mode ?? "none"} className={inputClass}>
            {TITHE_MODES.map((m) => (
              <option key={m} value={m}>
                {TITHE_LABELS[m]}
              </option>
            ))}
          </select>
        </label>

        <label className="block sm:col-span-2">
          <span className={labelClass}>
            Offering value (% if percent, $ if fixed)
            <FieldHint text={INCOME_HINTS.tithe_value} label="offering value" />
          </span>
          <input
            type="text"
            inputMode="decimal"
            name="tithe_value"
            aria-label="Offering value"
            defaultValue={income?.tithe_value ?? ""}
            placeholder="10  ·  or  250.00"
            className={inputClass}
          />
        </label>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? "Saving…" : editing ? "Save income" : "Add income"}
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

type Mode = { kind: "list" } | { kind: "create" } | { kind: "edit"; income: Income };

export function IncomeClient({ incomes }: { incomes: Income[] }) {
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const toList = useCallback(() => setMode({ kind: "list" }), []);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className={labelClass}>// income</p>
          <h1 className="mt-2 font-sans text-3xl font-medium text-[var(--color-text-primary)]">
            Your income
          </h1>
        </div>
        {mode.kind === "list" ? (
          <button onClick={() => setMode({ kind: "create" })} className={primaryButtonClass}>
            New income
          </button>
        ) : null}
      </header>

      {mode.kind === "create" ? <IncomeForm onDone={toList} onCancel={toList} /> : null}
      {mode.kind === "edit" ? <IncomeForm income={mode.income} onDone={toList} onCancel={toList} /> : null}

      {mode.kind === "list" ? (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-2">
            <StatCard label="Income sources" value={String(incomes.length)} accentVar="--color-accent-emerald" />
            <StatCard
              label="With offering"
              value={String(incomes.filter((i) => i.tithe_mode !== "none").length)}
              accentVar="--color-accent-blue"
            />
          </div>

          {incomes.length === 0 ? (
            <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-strong)] p-10 text-center">
              <p className="font-mono text-sm text-[var(--color-text-muted)]">
                // no income yet — add your paychecks to start planning
              </p>
            </div>
          ) : (
            <ul aria-label="Income" className="grid gap-4 lg:grid-cols-2">
              {incomes.map((income) => (
                <li
                  key={income.id}
                  className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-sans text-base font-medium text-[var(--color-text-primary)]">
                        {income.source}
                      </p>
                      <p className="mt-1 font-mono text-[11px] tracking-[0.18em] text-[var(--color-text-muted)] uppercase">
                        {INCOME_CADENCE_LABELS[income.cadence]}
                        {income.pay_day ? ` · day ${income.pay_day}` : ""}
                      </p>
                    </div>
                    <p className="font-sans text-2xl font-medium text-[var(--color-text-primary)] tabular-nums">
                      {formatUsd(Number(income.amount))}
                    </p>
                  </div>
                  <p className="mt-3 font-mono text-[11px] text-[var(--color-text-secondary)]">{titheSummary(income)}</p>
                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <button onClick={() => setMode({ kind: "edit", income })} className={ghostButtonClass}>
                      Edit
                    </button>
                    <ArchiveButton id={income.id} name={income.source} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </div>
  );
}

function ArchiveButton({ id, name }: { id: string; name: string }) {
  const [state, formAction] = useActionState(archiveIncome, INITIAL_FINANCE_STATE);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(`Archive "${name}"? It'll be hidden from your income.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="flex h-11 items-center justify-center rounded-md px-4 font-mono text-xs tracking-[0.18em] text-[var(--color-text-muted)] uppercase transition-colors hover:text-[var(--color-accent-red)]"
      >
        Archive
      </button>
      {state.error ? <span role="alert" className={`ml-2 ${errorClass}`}>{state.error}</span> : null}
    </form>
  );
}
