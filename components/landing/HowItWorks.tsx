import { TerminalCard } from "./TerminalCard";

export function HowItWorks() {
  return (
    <section
      aria-labelledby="how-it-works"
      className="border-t border-[var(--color-border-subtle)] px-6 py-24 sm:px-10"
    >
      <div className="mx-auto max-w-6xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--color-text-muted)]">
          // how it works
        </p>
        <h2
          id="how-it-works"
          className="mt-4 max-w-3xl font-sans text-3xl font-medium leading-tight text-[var(--color-text-primary)] sm:text-4xl"
        >
          Type your numbers in. Pick a strategy. Get a month-by-month plan.
        </h2>
        <p className="mt-4 max-w-2xl text-sm text-[var(--color-text-secondary)]">
          NZX runs the math deterministically — no guesswork, no opaque AI black-box for the
          core plan. Free tier is enough to get you out.
        </p>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          <TerminalCard
            accentVar="--color-accent-amber"
            label="01 / enter"
            headline="Your debts, your way"
            body="Cards, loans, mortgage, medical — type them in. Balances, APR, minimums. Nothing leaves your account."
            meta="manual entry · no bank link"
          />
          <TerminalCard
            accentVar="--color-accent-blue"
            label="02 / strategy"
            headline="Snowball or avalanche"
            body="Smallest-balance-first to keep momentum, or highest-APR-first to pay less interest. Toggle and compare."
            meta="deterministic · auditable"
          />
          <TerminalCard
            accentVar="--color-accent-emerald"
            label="03 / plan"
            headline="A schedule that ends at zero"
            body="Month-by-month payments, total interest, payoff date. Export it. Stick to it."
            meta="from $0 — free tier"
          />
        </div>
      </div>
    </section>
  );
}
