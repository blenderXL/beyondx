"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Info } from "lucide-react";
import { savePaystubInputs } from "@/app/(app)/actions";
import { formatUsd } from "@/lib/finance/derive";
import {
  estimatePaystub,
  dividePaystub,
  STATES,
  STATE_TAX_RATE,
  FILING_LABELS,
  type PaystubInputs,
  type PayCadence,
  type FilingStatus,
  type PayType,
} from "@/lib/paystub/tax";
import { inputClass, labelClass } from "@/components/finance/formStyles";

const CADENCE_LABELS: Record<PayCadence, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  semimonthly: "Twice a month",
  monthly: "Monthly",
  annual: "Annually",
};

const DEFAULTS: PaystubInputs = {
  payType: "salary",
  rate: 60000,
  hoursPerWeek: 40,
  cadence: "biweekly",
  state: "CA",
  filingStatus: "single",
  pretax401kPct: 0,
  otherPretaxMonthly: 0,
};

export function PaystubClient({ initial }: { initial?: Partial<PaystubInputs> }) {
  const [input, setInput] = useState<PaystubInputs>({ ...DEFAULTS, ...initial });
  const set = <K extends keyof PaystubInputs>(k: K, v: PaystubInputs[K]) =>
    setInput((prev) => ({ ...prev, [k]: v }));

  // Debounced persistence — remember the last inputs without saving on every keystroke.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(() => void savePaystubInputs(input), 800);
    return () => clearTimeout(t);
  }, [input]);

  const annual = useMemo(() => estimatePaystub(input), [input]);
  const perCheck = useMemo(() => dividePaystub(annual, annual.periodsPerYear), [annual]);
  const monthly = useMemo(() => dividePaystub(annual, 12), [annual]);

  const rows: { label: string; key: keyof typeof perCheck; tone?: string }[] = [
    { label: "Gross pay", key: "gross" },
    { label: "401(k)", key: "pretax401k", tone: "--color-accent-blue" },
    { label: "Other pre-tax", key: "otherPretax", tone: "--color-accent-blue" },
    { label: "Federal tax", key: "federal", tone: "--color-accent-red" },
    { label: "Social Security", key: "socialSecurity", tone: "--color-accent-red" },
    { label: "Medicare", key: "medicare", tone: "--color-accent-red" },
    { label: "State tax", key: "state", tone: "--color-accent-red" },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <p className={labelClass}>// paycheck calculator</p>
        <h1 className="mt-2 font-sans text-3xl font-medium text-[var(--color-text-primary)]">Estimate your take-home</h1>
      </header>

      {/* Disclaimer */}
      <div className="mb-6 flex items-start gap-2 rounded-[var(--radius-card)] border border-[color-mix(in_oklab,var(--color-accent-amber),transparent_60%)] bg-[color-mix(in_oklab,var(--color-accent-amber),transparent_92%)] p-3">
        <Info className="mt-0.5 size-4 shrink-0 text-[var(--color-accent-amber)]" aria-hidden />
        <p className="font-mono text-[11px] leading-relaxed text-[var(--color-text-secondary)]">
          Estimate only — 2025 federal brackets + FICA and a simplified per-state rate. No local taxes, SDI,
          or credits. Not tax advice; your real paycheck will differ.
        </p>
      </div>

      <div className="lg:grid lg:grid-cols-[20rem_1fr] lg:items-start lg:gap-6">
        {/* Inputs */}
        <section className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-6">
          <p className={labelClass}>// your pay</p>

          {/* Pay type toggle */}
          <div role="group" aria-label="Pay type" className="mt-4 inline-flex rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] p-0.5">
            {(["salary", "hourly"] as PayType[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => set("payType", v)}
                aria-pressed={input.payType === v}
                className={`rounded px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors ${
                  input.payType === v
                    ? "bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                }`}
              >
                {v === "salary" ? "Salary" : "Hourly"}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {input.payType === "salary" ? (
              <label className="block sm:col-span-2">
                <span className={labelClass}>Annual salary</span>
                <input
                  type="number"
                  inputMode="decimal"
                  aria-label="Annual salary"
                  min={0}
                  value={input.rate || ""}
                  onChange={(e) => set("rate", Number(e.target.value) || 0)}
                  className={inputClass}
                />
              </label>
            ) : (
              <>
                <label className="block">
                  <span className={labelClass}>Hourly rate</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    aria-label="Hourly rate"
                    min={0}
                    value={input.rate || ""}
                    onChange={(e) => set("rate", Number(e.target.value) || 0)}
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>Hours / week</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    aria-label="Hours per week"
                    min={0}
                    max={168}
                    value={input.hoursPerWeek || ""}
                    onChange={(e) => set("hoursPerWeek", Number(e.target.value) || 0)}
                    className={inputClass}
                  />
                </label>
              </>
            )}

            <label className="block">
              <span className={labelClass}>Pay frequency</span>
              <select
                aria-label="Pay frequency"
                value={input.cadence}
                onChange={(e) => set("cadence", e.target.value as PayCadence)}
                className={inputClass}
              >
                {(Object.keys(CADENCE_LABELS) as PayCadence[]).map((c) => (
                  <option key={c} value={c}>
                    {CADENCE_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className={labelClass}>Filing status</span>
              <select
                aria-label="Filing status"
                value={input.filingStatus}
                onChange={(e) => set("filingStatus", e.target.value as FilingStatus)}
                className={inputClass}
              >
                {(Object.keys(FILING_LABELS) as FilingStatus[]).map((f) => (
                  <option key={f} value={f}>
                    {FILING_LABELS[f]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className={labelClass}>State</span>
              <select
                aria-label="State"
                value={input.state}
                onChange={(e) => set("state", e.target.value)}
                className={inputClass}
              >
                {STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                    {STATE_TAX_RATE[s.code] === 0 ? " (no income tax)" : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className={labelClass}>401(k) %</span>
              <input
                type="number"
                inputMode="decimal"
                aria-label="401(k) percent"
                min={0}
                max={100}
                value={input.pretax401kPct || ""}
                onChange={(e) => set("pretax401kPct", Number(e.target.value) || 0)}
                className={inputClass}
              />
            </label>

            <label className="block sm:col-span-2">
              <span className={labelClass}>Other pre-tax / month (health, HSA…)</span>
              <input
                type="number"
                inputMode="decimal"
                aria-label="Other pre-tax per month"
                min={0}
                value={input.otherPretaxMonthly || ""}
                onChange={(e) => set("otherPretaxMonthly", Number(e.target.value) || 0)}
                className={inputClass}
              />
            </label>
          </div>
        </section>

        {/* Breakdown */}
        <aside className="mt-6 lg:mt-0 lg:sticky lg:top-6">
          <section className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-6">
            <p className={labelClass}>// take-home pay</p>
            <p className="mt-3 font-sans text-3xl font-medium tabular-nums text-[var(--color-accent-emerald)]">
              {formatUsd(perCheck.net)}
              <span className="ml-2 font-mono text-[11px] text-[var(--color-text-muted)]">/ paycheck</span>
            </p>
            <p className="mt-1 font-mono text-[11px] text-[var(--color-text-secondary)]">
              {formatUsd(monthly.net)}/mo · {formatUsd(annual.net)}/yr
            </p>

            <div className="mt-5 overflow-hidden rounded-md border border-[var(--color-border-subtle)]">
              <table className="w-full font-mono text-[11px]">
                <thead className="bg-[var(--color-elevated)] text-[var(--color-text-muted)]">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left font-normal">Item</th>
                    <th scope="col" className="px-3 py-2 text-right font-normal">Check</th>
                    <th scope="col" className="px-3 py-2 text-right font-normal">Monthly</th>
                    <th scope="col" className="px-3 py-2 text-right font-normal">Annual</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key} className="border-t border-[var(--color-border-subtle)]">
                      <td className="px-3 py-1.5 text-left" style={{ color: r.tone ? `var(${r.tone})` : "var(--color-text-secondary)" }}>
                        {r.label}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-[var(--color-text-secondary)]">{formatUsd(perCheck[r.key])}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-[var(--color-text-secondary)]">{formatUsd(monthly[r.key])}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-[var(--color-text-secondary)]">{formatUsd(annual[r.key])}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-[var(--color-border-strong)] bg-[var(--color-elevated)]">
                    <td className="px-3 py-2 text-left font-medium text-[var(--color-text-primary)]">Take-home</td>
                    <td className="px-3 py-2 text-right tabular-nums text-[var(--color-accent-emerald)]">{formatUsd(perCheck.net)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-[var(--color-accent-emerald)]">{formatUsd(monthly.net)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-[var(--color-accent-emerald)]">{formatUsd(annual.net)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
