import { cn } from "@/lib/utils";

interface Props {
  /** CSS color variable name from globals.css (without `var()`). */
  accentVar:
    | "--color-accent-amber"
    | "--color-accent-red"
    | "--color-accent-emerald"
    | "--color-accent-blue"
    | "--color-accent-purple"
    | "--color-accent-pink";
  /** Short label, monospace upper. */
  label: string;
  /** Big number/title. */
  headline: string;
  /** Supporting copy. */
  body: string;
  /** Tiny metric line below (mimics image 2's $874 subtext). */
  meta?: string;
  className?: string;
}

/**
 * Card with a colored left strip (per inspiration image 2 — Open Purpose tags).
 * Used in the "How it works" section of the landing and elsewhere.
 */
export function TerminalCard({ accentVar, label, headline, body, meta, className }: Props) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-6 transition-colors hover:border-[var(--color-border-strong)]",
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute left-0 top-4 h-6 w-[2px]"
        style={{ background: `var(${accentVar})` }}
      />
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
        {label}
      </p>
      <p className="mt-3 font-sans text-2xl font-medium leading-tight text-[var(--color-text-primary)]">
        {headline}
      </p>
      <p className="mt-3 max-w-prose text-sm text-[var(--color-text-secondary)]">{body}</p>
      {meta ? (
        <p className="mt-4 font-mono text-[11px] tracking-wide text-[var(--color-text-muted)]">{meta}</p>
      ) : null}
    </div>
  );
}
