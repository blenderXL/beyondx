import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Pricing" };

const tiers = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    accent: "--color-accent-emerald",
    features: [
      "Unlimited manual debts, incomes, expenses",
      "Snowball + avalanche calculators",
      "Month-by-month payoff schedule",
      "Basic charts",
      "Single-user account",
    ],
    cta: { href: "/signup", label: "Get started" },
  },
  {
    name: "Pro",
    price: "Coming soon",
    cadence: "v1.1",
    accent: "--color-accent-purple",
    features: [
      "Everything in Free",
      "AI assistant (chat through your plan)",
      "Advanced charts and metrics",
      "PDF export",
      "Scenario compare (snowball vs. avalanche vs. custom)",
      "Priority support",
    ],
    cta: { href: "/signup", label: "Join the early list" },
  },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-24 sm:px-10">
      <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--color-text-muted)]">
        // pricing
      </p>
      <h1 className="mt-4 font-sans text-3xl font-medium leading-tight text-[var(--color-text-primary)] sm:text-4xl">
        Free does the work. Pro adds the assistant.
      </h1>

      <div className="mt-12 grid gap-4 md:grid-cols-2">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className="relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-8"
          >
            <span
              aria-hidden
              className="absolute left-0 top-6 h-8 w-[2px]"
              style={{ background: `var(${tier.accent})` }}
            />
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
              {tier.name}
            </p>
            <p className="mt-3 font-sans text-3xl font-medium text-[var(--color-text-primary)]">
              {tier.price}
              <span className="ml-2 font-mono text-xs uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                {tier.cadence}
              </span>
            </p>
            <ul className="mt-6 space-y-2 text-sm text-[var(--color-text-secondary)]">
              {tier.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <span aria-hidden className="mt-2 inline-block size-1 rounded-full bg-[var(--color-text-muted)]" />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href={tier.cta.href}
              className="mt-8 inline-flex h-10 items-center rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] px-5 font-mono text-xs uppercase tracking-[0.18em] text-[var(--color-text-primary)] hover:border-[var(--color-text-primary)]"
            >
              {tier.cta.label}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
