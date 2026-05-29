import type { Metadata } from "next";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-24 sm:px-10">
      <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--color-text-muted)]">
        // about
      </p>
      <h1 className="mt-4 font-sans text-3xl font-medium leading-tight text-[var(--color-text-primary)] sm:text-4xl">
        NZX is a planner for getting out of debt.
      </h1>
      <p className="mt-6 max-w-prose text-sm leading-relaxed text-[var(--color-text-secondary)]">
        Type in what you owe. Pick snowball or avalanche. Get a month-by-month schedule that
        ends at zero. The math is deterministic and auditable — no opaque models in the
        critical path. The optional AI assistant is exactly that: optional.
      </p>
      <p className="mt-4 max-w-prose text-sm leading-relaxed text-[var(--color-text-secondary)]">
        Free tier handles the planning. Pro adds an assistant, advanced charts, exports, and
        scenario comparisons.
      </p>
    </div>
  );
}
