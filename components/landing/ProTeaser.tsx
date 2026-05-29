import Link from "next/link";

export function ProTeaser() {
  return (
    <section
      aria-labelledby="pro-teaser"
      className="border-t border-[var(--color-border-subtle)] px-6 py-24 sm:px-10"
    >
      <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--color-accent-purple)]">
            // pro — soon
          </p>
          <h2
            id="pro-teaser"
            className="mt-4 font-sans text-3xl font-medium leading-tight text-[var(--color-text-primary)] sm:text-4xl"
          >
            An AI assistant that reads your portfolio and proposes the path.
          </h2>
          <p className="mt-4 max-w-prose text-sm text-[var(--color-text-secondary)]">
            Pro unlocks an assistant that looks at your real numbers, simulates snowball vs.
            avalanche vs. custom orderings, and walks you through the trade-offs in plain
            English. Plus advanced charts, exportable PDFs, and more.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/signup"
              className="inline-flex h-10 items-center rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] px-5 font-mono text-xs uppercase tracking-[0.18em] text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-text-primary)]"
            >
              Get started · free
            </Link>
            <Link
              href="/pricing"
              className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            >
              See pricing →
            </Link>
          </div>
        </div>

        <ul className="grid grid-cols-2 gap-3 self-center">
          {(
            [
              { tag: "AI assistant", accent: "--color-accent-purple", note: "chat through your plan" },
              { tag: "Advanced charts", accent: "--color-accent-blue", note: "interest, time saved" },
              { tag: "Export PDF", accent: "--color-accent-emerald", note: "share with anyone" },
              { tag: "Scenario compare", accent: "--color-accent-amber", note: "snowball vs avalanche" },
            ] as const
          ).map((f) => (
            <li
              key={f.tag}
              className="relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-4"
            >
              <span
                aria-hidden
                className="absolute left-0 top-3 h-5 w-[2px]"
                style={{ background: `var(${f.accent})` }}
              />
              <p className="font-sans text-base font-medium text-[var(--color-text-primary)]">{f.tag}</p>
              <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                {f.note}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
