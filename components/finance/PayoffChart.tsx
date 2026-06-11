"use client";

import { useMemo, useRef, useState } from "react";
import { formatUsd } from "@/lib/finance/derive";

/** Palette for the per-debt curves (cycled). Emerald = total, amber = interest, so start elsewhere. */
const DEBT_PALETTE = [
  "--color-accent-blue",
  "--color-accent-purple",
  "--color-accent-pink",
  "--color-accent-red",
  "--color-accent-amber",
  "--color-accent-emerald",
] as const;

function compactUsdShort(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}

export interface PayoffDebtSeries {
  id: string;
  name: string;
  /** Balance at each point (length = strategy.length; index 0 = today). */
  balance: number[];
}

/**
 * Interactive payoff projection. Draws the chosen strategy's total-balance curve (emerald
 * area+line) against the minimums-only baseline (muted dashed), plus a cumulative-interest
 * curve (amber) and one toggleable curve per debt. Hovering shows a vertical guide and a
 * tooltip with every visible series' value at that month. Plain SVG + a thin client layer
 * for the hover state and legend toggles.
 */
export function PayoffChart({
  strategy,
  baseline,
  interest,
  debts,
  pointLabels,
  strategyLabel,
}: {
  strategy: number[];
  baseline: number[];
  /** Cumulative interest paid at each point (index 0 = today = 0). */
  interest: number[];
  debts: PayoffDebtSeries[];
  /** Calendar label per point ("Today", "Aug 2026", …); length = strategy.length. */
  pointLabels: string[];
  strategyLabel: string;
}) {
  // Interest curve on by default; per-debt curves off (so a wallet of 7 debts doesn't clutter).
  const [showInterest, setShowInterest] = useState(true);
  const [shownDebts, setShownDebts] = useState<Record<string, boolean>>({});
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const n = Math.max(strategy.length, baseline.length);

  // Fixed y-max across ALL series (visible or not) so toggling curves never rescales the axes.
  const max = useMemo(() => {
    let m = 1;
    for (const v of strategy) m = Math.max(m, v);
    for (const v of baseline) m = Math.max(m, v);
    for (const v of interest) m = Math.max(m, v);
    for (const d of debts) for (const v of d.balance) m = Math.max(m, v);
    return m;
  }, [strategy, baseline, interest, debts]);

  if (n < 2) {
    return <p className="font-mono text-[11px] text-[var(--color-text-muted)]">// not enough data to chart yet</p>;
  }

  // Wide aspect ratio so the chart fills the card; `w-full` (height from the viewBox) scales it
  // uniformly — a fixed pixel height + meet would letterbox a narrow viewBox in the middle.
  const W = 760;
  const H = 184;
  const ml = 46;
  const mb = 24;
  const mt = 10;
  const mr = 8;
  const pw = W - ml - mr;
  const ph = H - mt - mb;
  const x = (i: number) => ml + (i / (n - 1)) * pw;
  const y = (v: number) => mt + ph - (v / max) * ph;
  const toPath = (vals: number[]) => "M" + vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" L");
  const yTicks = [0, max / 2, max];

  const now = new Date();
  const yearLabel = (i: number) =>
    i === 0 ? "Today" : String(new Date(now.getFullYear(), now.getMonth() + i, 1).getFullYear());
  // ~4 evenly spaced year ticks (Today + up to 3 future years), always ending at the payoff.
  const stepYears = Math.max(1, Math.round((n - 1) / 12 / 3));
  const rawTicks: number[] = [];
  for (let i = 0; i < n - 1; i += stepYears * 12) rawTicks.push(i);
  rawTicks.push(n - 1);
  // Drop a tick when the next one carries the same year label (keep the later/right-most).
  const xTicks = rawTicks.filter((i, idx) => {
    const next = rawTicks[idx + 1];
    return next === undefined || yearLabel(next) !== yearLabel(i);
  });
  const tickText = { fontSize: 9, fontFamily: "var(--font-mono)", fill: "var(--color-text-muted)" } as const;

  const visibleDebts = debts.filter((d) => shownDebts[d.id]);

  function onMove(e: React.MouseEvent) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const vbx = ((e.clientX - rect.left) / rect.width) * W; // viewBox-space x
    const i = Math.round(((vbx - ml) / pw) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  }

  // Tooltip rows for the hovered point — total + (visible) interest + visible debts.
  const hoverRows =
    hover === null
      ? []
      : [
          { label: strategyLabel, accent: "--color-accent-emerald", value: strategy[hover] ?? 0 },
          { label: "minimums only", accent: "--color-text-muted", value: baseline[hover] ?? 0 },
          ...(showInterest ? [{ label: "interest", accent: "--color-accent-amber", value: interest[hover] ?? 0 }] : []),
          ...visibleDebts.map((d, idx) => ({
            label: d.name,
            accent: DEBT_PALETTE[idx % DEBT_PALETTE.length],
            value: d.balance[hover] ?? 0,
          })),
        ];
  const hoverLeftPct = hover === null ? 0 : (x(hover) / W) * 100;
  const flip = hoverLeftPct > 60; // anchor the tooltip to the left of the guide near the right edge

  return (
    <div>
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full"
          role="img"
          aria-label="Payoff curve vs. minimums only"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            {/* Vertical emerald fade — the area's depth (stitch reference). */}
            <linearGradient id="payoffGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent-emerald)" stopOpacity="0.32" />
              <stop offset="100%" stopColor="var(--color-accent-emerald)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {yTicks.map((t, i) => (
            <g key={i}>
              <line
                x1={ml}
                y1={y(t)}
                x2={W - mr}
                y2={y(t)}
                stroke="var(--color-border-subtle)"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              <text x={ml - 6} y={y(t) + 3} textAnchor="end" style={tickText}>
                {compactUsdShort(t)}
              </text>
            </g>
          ))}
          {xTicks.map((i, idx) => (
            <text
              key={i}
              x={x(i)}
              y={H - 8}
              textAnchor={idx === 0 ? "start" : idx === xTicks.length - 1 ? "end" : "middle"}
              style={tickText}
            >
              {yearLabel(i)}
            </text>
          ))}

          {/* Baseline: minimums-only, muted + dashed. */}
          <path
            d={toPath(baseline)}
            fill="none"
            stroke="var(--color-text-muted)"
            strokeWidth={1.25}
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />

          {/* Per-debt curves (toggleable). */}
          {visibleDebts.map((d, idx) => (
            <path
              key={d.id}
              d={toPath(d.balance)}
              fill="none"
              stroke={`var(${DEBT_PALETTE[idx % DEBT_PALETTE.length]})`}
              strokeWidth={1.25}
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {/* Cumulative interest (toggleable), amber. */}
          {showInterest ? (
            <path
              d={toPath(interest)}
              fill="none"
              stroke="var(--color-accent-amber)"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
          ) : null}

          {/* Strategy: emerald area (gradient depth) + line. */}
          <path d={`${toPath(strategy)} L${x(strategy.length - 1).toFixed(1)},${y(0)} L${x(0)},${y(0)} Z`} fill="url(#payoffGrad)" />
          <path
            d={toPath(strategy)}
            fill="none"
            stroke="var(--color-accent-emerald)"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />

          {/* Hover guide + dots on every visible series. */}
          {hover !== null ? (
            <g pointerEvents="none">
              <line
                x1={x(hover)}
                y1={mt}
                x2={x(hover)}
                y2={mt + ph}
                stroke="var(--color-text-secondary)"
                strokeWidth={1}
                strokeDasharray="2 2"
                vectorEffect="non-scaling-stroke"
              />
              <circle cx={x(hover)} cy={y(strategy[hover] ?? 0)} r={3} fill="var(--color-accent-emerald)" />
              {showInterest ? (
                <circle cx={x(hover)} cy={y(interest[hover] ?? 0)} r={2.5} fill="var(--color-accent-amber)" />
              ) : null}
              {visibleDebts.map((d, idx) => (
                <circle
                  key={d.id}
                  cx={x(hover)}
                  cy={y(d.balance[hover] ?? 0)}
                  r={2.5}
                  fill={`var(${DEBT_PALETTE[idx % DEBT_PALETTE.length]})`}
                />
              ))}
            </g>
          ) : null}
        </svg>

        {/* Tooltip — HTML overlay positioned at the guide. */}
        {hover !== null ? (
          <div
            className="pointer-events-none absolute top-1 z-10 w-44 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] p-2 shadow-lg"
            style={{ left: `${hoverLeftPct}%`, transform: flip ? "translateX(calc(-100% - 10px))" : "translateX(10px)" }}
          >
            <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
              {pointLabels[hover] ?? yearLabel(hover)}
            </p>
            <ul className="space-y-0.5">
              {hoverRows.map((r) => (
                <li key={r.label} className="flex items-center justify-between gap-2 font-mono text-[10px]">
                  <span className="flex min-w-0 items-center gap-1.5 text-[var(--color-text-secondary)]">
                    <span className="size-1.5 shrink-0 rounded-full" style={{ background: `var(${r.accent})` }} aria-hidden />
                    <span className="truncate">{r.label}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-[var(--color-text-primary)]">{formatUsd(r.value)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {/* Legend — total + baseline are fixed; interest + per-debt are toggle chips. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-[10px]">
        <span className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
          <span className="inline-block h-0.5 w-3" style={{ background: "var(--color-accent-emerald)" }} aria-hidden />
          {strategyLabel}
        </span>
        <span className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
          <span className="inline-block h-0 w-3 border-t border-dashed border-[var(--color-text-muted)]" aria-hidden />
          minimums only
        </span>
        <LegendToggle
          on={showInterest}
          accent="--color-accent-amber"
          label="interest"
          onClick={() => setShowInterest((v) => !v)}
        />
        {debts.map((d, idx) => (
          <LegendToggle
            key={d.id}
            on={!!shownDebts[d.id]}
            accent={DEBT_PALETTE[idx % DEBT_PALETTE.length] ?? DEBT_PALETTE[0]}
            label={d.name}
            onClick={() => setShownDebts((s) => ({ ...s, [d.id]: !s[d.id] }))}
          />
        ))}
      </div>
    </div>
  );
}

/** A pressable legend chip that toggles a curve on/off (dimmed when off). */
function LegendToggle({
  on,
  accent,
  label,
  onClick,
}: {
  on: boolean;
  accent: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 transition-colors ${
        on
          ? "border-[var(--color-border-strong)] text-[var(--color-text-secondary)]"
          : "border-[var(--color-border-subtle)] text-[var(--color-text-muted)] opacity-50 hover:opacity-100"
      }`}
    >
      <span className="inline-block size-1.5 rounded-full" style={{ background: `var(${accent})` }} aria-hidden />
      <span className="max-w-[8rem] truncate">{label}</span>
    </button>
  );
}
