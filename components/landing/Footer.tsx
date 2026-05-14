import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";

const COLS = [
  {
    heading: "Product",
    links: [
      { href: "/pricing", label: "Pricing" },
      { href: "/faq", label: "FAQ" },
      { href: "/about", label: "About" },
    ],
  },
  {
    heading: "Account",
    links: [
      { href: "/login", label: "Log in" },
      { href: "/signup", label: "Sign up" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/legal/terms", label: "Terms" },
      { href: "/legal/privacy", label: "Privacy" },
      { href: "/legal/disclaimer", label: "Not financial advice" },
    ],
  },
];

export function Footer() {
  return (
    <footer
      role="contentinfo"
      className="border-t border-[var(--color-border-subtle)] px-6 py-16 sm:px-10"
    >
      <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Wordmark size="md" />
          <p className="mt-4 max-w-[36ch] font-mono text-xs leading-relaxed text-[var(--color-text-secondary)]">
            // NZX is a personal debt-payoff and budgeting planner. Manual entry, deterministic
            math, optional AI assistant.
          </p>
        </div>
        {COLS.map((col) => (
          <div key={col.heading}>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
              {col.heading}
            </p>
            <ul className="mt-4 space-y-2 font-mono text-xs text-[var(--color-text-secondary)]">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-[var(--color-text-primary)]">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-12 max-w-6xl border-t border-[var(--color-border-subtle)] pt-6 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
        © {new Date().getFullYear()} NZX. Not a financial advisor.
      </div>
    </footer>
  );
}
