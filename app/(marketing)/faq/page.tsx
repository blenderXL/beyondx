import type { Metadata } from "next";

export const metadata: Metadata = { title: "FAQ" };

const items = [
  {
    q: "Do you connect to my bank?",
    a: "No. NZX is manual-entry only. You type in balances, APRs, minimums. Your financial data stays in your account; nothing is fetched from your bank.",
  },
  {
    q: "Is this financial advice?",
    a: "No. NZX is a planning tool. The math is deterministic and the schedules it produces are estimates based on what you enter. Consult a licensed advisor for your specific situation.",
  },
  {
    q: "Snowball or avalanche — which should I pick?",
    a: "Avalanche (highest APR first) almost always pays less interest. Snowball (smallest balance first) pays a little more in interest but tends to be easier to stick with because you knock out whole debts faster. Try both and compare.",
  },
  {
    q: "What does Pro add?",
    a: "An AI assistant that reads your portfolio and proposes plans in plain English, advanced charts, PDF export, and scenario comparison. Coming in v1.1.",
  },
];

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-24 sm:px-10">
      <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--color-text-muted)]">
        // faq
      </p>
      <h1 className="mt-4 font-sans text-3xl font-medium leading-tight text-[var(--color-text-primary)] sm:text-4xl">
        Common questions
      </h1>
      <dl className="mt-12 space-y-10">
        {items.map((item) => (
          <div key={item.q}>
            <dt className="font-sans text-lg font-medium text-[var(--color-text-primary)]">
              {item.q}
            </dt>
            <dd className="mt-3 max-w-prose text-sm leading-relaxed text-[var(--color-text-secondary)]">
              {item.a}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
