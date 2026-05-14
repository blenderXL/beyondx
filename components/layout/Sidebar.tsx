"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CreditCard,
  TrendingUp,
  Wallet,
  CalendarRange,
  Sparkles,
  Settings,
  Lock,
} from "lucide-react";
import { Wordmark } from "@/components/brand/Wordmark";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/debts", label: "Debts", icon: CreditCard },
  { href: "/app/income", label: "Income", icon: TrendingUp },
  { href: "/app/expenses", label: "Expenses", icon: Wallet },
  { href: "/app/plans", label: "Plans", icon: CalendarRange },
  { href: "/app/assistant", label: "Assistant", icon: Sparkles, proOnly: true },
  { href: "/app/settings", label: "Settings", icon: Settings },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex h-full w-60 flex-col border-r border-[var(--color-border-subtle)] bg-[var(--color-surface)]">
      <div className="px-6 py-6">
        <Link href="/app" aria-label="NZX app home">
          <Wordmark size="md" />
        </Link>
      </div>
      <nav aria-label="App" className="flex-1 px-3">
        <ul className="space-y-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || (item.href !== "/app" && pathname.startsWith(item.href));
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-md px-3 py-2 font-sans text-sm transition-colors",
                    active
                      ? "bg-[var(--color-elevated)] text-[var(--color-text-primary)]"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-elevated)] hover:text-[var(--color-text-primary)]",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  <span className="flex-1">{item.label}</span>
                  {"proOnly" in item && item.proOnly ? (
                    <Lock
                      aria-label="Requires Pro"
                      className="size-3 text-[var(--color-accent-amber)]"
                    />
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-[var(--color-border-subtle)] p-3">
        <div className="rounded-md border border-dashed border-[var(--color-border-strong)] p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-accent-purple)]">
            // pro · soon
          </p>
          <p className="mt-1 font-sans text-xs text-[var(--color-text-secondary)]">
            Unlock the AI assistant, advanced charts, and exports.
          </p>
        </div>
      </div>
    </aside>
  );
}
