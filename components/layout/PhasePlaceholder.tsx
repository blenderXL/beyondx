interface Props {
  area: string;
  arriving: string;
  description: string;
}

/** Reused on every /app/* stub page until v1.1 fills them. */
export function PhasePlaceholder({ area, arriving, description }: Props) {
  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--color-text-muted)]">
          // {area.toLowerCase()}
        </p>
        <h1 className="mt-3 font-sans text-3xl font-medium leading-tight text-[var(--color-text-primary)]">
          {area}
        </h1>
        <p className="mt-2 max-w-prose text-sm text-[var(--color-text-secondary)]">{description}</p>
      </div>
      <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)] p-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-accent-blue)]">
          // arriving in {arriving}
        </p>
        <p className="mt-3 max-w-prose font-sans text-sm text-[var(--color-text-secondary)]">
          v1.0 ships the shell and the schema. Real CRUD, math, and visualizations land in {arriving}.
        </p>
      </div>
    </div>
  );
}
