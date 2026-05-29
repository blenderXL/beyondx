import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";
import { DayNightToggle } from "./DayNightToggle";

const ITEMS = [
  { href: "/about", label: "About" },
  { href: "/pricing", label: "Pricing" },
  { href: "/faq", label: "FAQ" },
] as const;

export function TopNav() {
  return (
    <header className="relative z-20 px-6 pt-6 sm:px-10 sm:pt-8">
      <div className="grid grid-cols-3 items-center">
        <nav aria-label="Primary" className="flex items-center gap-6">
          <ul className="flex items-center gap-5 font-mono text-xs uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
            {ITEMS.map((item) => (
              <li key={item.href} className="flex items-center gap-2">
                <span aria-hidden className="inline-block size-1 rounded-full bg-[var(--color-text-muted)]" />
                <Link
                  href={item.href}
                  className="transition-colors hover:text-[var(--color-text-primary)]"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex justify-center">
          <Link href="/" aria-label="NZX home">
            <Wordmark size="md" />
          </Link>
        </div>
        <div className="flex items-center justify-end gap-4">
          <Link
            href="/login"
            className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
          >
            Log in
          </Link>
          <DayNightToggle />
        </div>
      </div>
    </header>
  );
}
