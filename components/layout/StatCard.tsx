interface Props {
  label: string;
  value: string;
  hint?: string;
  accentVar:
    | "--color-accent-amber"
    | "--color-accent-red"
    | "--color-accent-emerald"
    | "--color-accent-blue"
    | "--color-accent-purple"
    | "--color-accent-pink";
}

/** Matches inspiration image 2 — dark card with colored left strip + label + big number. */
export function StatCard({ label, value, hint, accentVar }: Props) {
  return (
    <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5">
      <span
        aria-hidden
        className="absolute left-0 top-4 h-6 w-[2px]"
        style={{ background: `var(${accentVar})` }}
      />
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
        {label}
      </p>
      <p className="mt-3 font-sans text-3xl font-medium tabular-nums text-[var(--color-text-primary)]">
        {value}
      </p>
      {hint ? (
        <p className="mt-3 font-mono text-[11px] text-[var(--color-text-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}
