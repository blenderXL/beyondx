/**
 * Dependency-free SVG charts (Phase 5). Deliberate, lightweight, on-brand — no chart
 * library. All are pure presentational server components.
 */

import { formatUsd } from "@/lib/finance/derive";

/** Area+line chart of a single series (e.g. total balance over months). */
export function SparkArea({
  values,
  accentVar = "--color-accent-emerald",
  height = 120,
}: {
  values: number[];
  accentVar?: string;
  height?: number;
}) {
  if (values.length < 2) {
    return (
      <p className="font-mono text-[11px] text-[var(--color-text-muted)]">// not enough data to chart yet</p>
    );
  }
  const w = 100;
  const max = Math.max(...values, 1);
  const stepX = w / (values.length - 1);
  const pts = values.map((v, i) => `${(i * stepX).toFixed(2)},${(height - (v / max) * height).toFixed(2)}`);
  const line = `M${pts.join(" L")}`;
  const area = `M0,${height} L${pts.join(" L")} L${w},${height} Z`;
  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
      role="img"
      aria-label="Trend chart"
    >
      <path d={area} fill={`var(${accentVar})`} opacity={0.15} />
      <path d={line} fill="none" stroke={`var(${accentVar})`} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function compactUsdShort(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}

/**
 * Payoff projection: the chosen strategy's balance curve over time, overlaid with the
 * minimums-only baseline for comparison. Labeled X (years) and Y ($ balance) axes. Plain SVG.
 */
export function PayoffChart({
  strategy,
  baseline,
  strategyLabel,
}: {
  strategy: number[];
  baseline: number[];
  strategyLabel: string;
}) {
  const n = Math.max(strategy.length, baseline.length);
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
  const max = Math.max(1, ...strategy, ...baseline);
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

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="Payoff curve vs. minimums only">
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
        {/* Strategy: emerald area (gradient depth) + line. */}
        <path d={`${toPath(strategy)} L${x(strategy.length - 1).toFixed(1)},${y(0)} L${x(0)},${y(0)} Z`} fill="url(#payoffGrad)" />
        <path
          d={toPath(strategy)}
          fill="none"
          stroke="var(--color-accent-emerald)"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="mt-2 flex items-center gap-4 font-mono text-[10px] text-[var(--color-text-muted)]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3" style={{ background: "var(--color-accent-emerald)" }} aria-hidden />
          {strategyLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0 w-3 border-t border-dashed border-[var(--color-text-muted)]" aria-hidden />
          minimums only
        </span>
      </div>
    </div>
  );
}

export interface BarItem {
  label: string;
  amount: number;
  pct: number; // 0..1
  accentVar?: string;
  /** Optional leading icon (e.g. a debt-type icon) shown before the label. */
  icon?: React.ReactNode;
}

/** Horizontal proportional bars (distribution / breakdown). */
export function BarList({ items, ariaLabel }: { items: BarItem[]; ariaLabel: string }) {
  if (items.length === 0) {
    return <p className="font-mono text-[11px] text-[var(--color-text-muted)]">// nothing to show yet</p>;
  }
  return (
    <ul aria-label={ariaLabel} className="space-y-3">
      {items.map((it) => (
        <li key={it.label}>
          <div className="flex items-center justify-between gap-4 font-mono text-[11px]">
            <span className="flex items-center gap-2 text-[var(--color-text-secondary)]">
              {it.icon ? <span className="text-[var(--color-text-muted)]">{it.icon}</span> : null}
              {it.label}
            </span>
            <span className="tabular-nums text-[var(--color-text-primary)]">
              {formatUsd(it.amount)} · {Math.round(it.pct * 100)}%
            </span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[var(--color-elevated)]">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(2, Math.round(it.pct * 100))}%`, background: `var(${it.accentVar ?? "--color-accent-blue"})` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export interface DonutSlice {
  label: string;
  value: number;
  accentVar: string;
}

/**
 * SVG donut of proportional slices. Segments are drawn as a single stroked ring using
 * `stroke-dasharray` (segment length) + a cumulative negative `stroke-dashoffset`, rotated
 * so the first slice starts at 12 o'clock. The center shows an optional total.
 */
export function DonutChart({
  slices,
  ariaLabel,
  centerLabel,
  centerValue,
}: {
  slices: DonutSlice[];
  ariaLabel: string;
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0);
  if (total <= 0) {
    return <p className="font-mono text-[11px] text-[var(--color-text-muted)]">// nothing to show yet</p>;
  }
  const size = 132;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="relative mx-auto w-fit">
      <svg viewBox={`0 0 ${size} ${size}`} className="size-36" role="img" aria-label={ariaLabel}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-elevated)" strokeWidth={stroke} />
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {slices.map((s) => {
            const dash = (Math.max(0, s.value) / total) * circ;
            const seg = (
              <circle
                key={s.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={`var(${s.accentVar})`}
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${circ - dash}`}
                strokeDashoffset={-offset}
              />
            );
            offset += dash;
            return seg;
          })}
        </g>
      </svg>
      {centerValue ? (
        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          <span className="font-sans text-xl font-semibold tabular-nums text-[var(--color-text-primary)]">
            {centerValue}
          </span>
          {centerLabel ? (
            <span className="mx-auto mt-0.5 max-w-[84px] truncate font-mono text-[8px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
              {centerLabel}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** A simple utilization gauge (0–100%+). */
export function UtilizationGauge({ pct }: { pct: number }) {
  const clamped = Math.min(1, Math.max(0, pct));
  const tone =
    pct > 0.7 ? "--color-accent-red" : pct > 0.3 ? "--color-accent-amber" : "--color-accent-emerald";
  return (
    <div>
      <p className="font-sans text-3xl font-medium tabular-nums text-[var(--color-text-primary)]">
        {Math.round(pct * 100)}%
      </p>
      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-elevated)]">
        <div className="h-full rounded-full" style={{ width: `${Math.round(clamped * 100)}%`, background: `var(${tone})` }} />
      </div>
      <p className="mt-2 font-mono text-[10px] text-[var(--color-text-muted)]">
        // lower is better — under 30% is healthy
      </p>
    </div>
  );
}
