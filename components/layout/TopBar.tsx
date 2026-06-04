"use client";

import { useRouter } from "next/navigation";
import { LogOut, Menu } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { DayNightToggle } from "@/components/landing/DayNightToggle";
import { resetUser } from "@/lib/telemetry/capture";
import { useSidebar } from "@/components/layout/SidebarProvider";

interface Props {
  email: string | null;
  displayName: string | null;
  tier: "free" | "pro";
  /** id of the nav drawer this bar's hamburger controls (for aria-controls). */
  drawerId: string;
}

export function TopBar({ email, displayName, tier, drawerId }: Props) {
  const router = useRouter();
  const { open, toggle } = useSidebar();

  async function signOut() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    // Forget the PostHog distinct id BEFORE navigation so the next anon view isn't merged.
    resetUser();
    router.replace("/");
    router.refresh();
  }
  const label = displayName ?? email ?? "";
  const initial = (label[0] ?? "?").toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          aria-label="Open navigation"
          aria-expanded={open}
          aria-controls={drawerId}
          className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] md:hidden"
        >
          <Menu className="size-4" />
        </button>
        <p className="hidden font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)] sm:block">
          // last updated · {new Date().toLocaleDateString()}
        </p>
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        <DayNightToggle />
        <span
          className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.22em]"
          style={{
            color:
              tier === "pro"
                ? "var(--color-accent-purple)"
                : "var(--color-text-secondary)",
          }}
          aria-label={`Current tier: ${tier}`}
        >
          {tier}
        </span>
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="grid size-7 place-items-center rounded-full bg-[var(--color-accent-blue)] font-sans text-xs font-medium text-[var(--color-canvas)]"
          >
            {initial}
          </span>
          <span className="hidden font-sans text-xs text-[var(--color-text-secondary)] sm:inline">
            {label}
          </span>
        </div>
        <button
          type="button"
          onClick={signOut}
          aria-label="Sign out"
          className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </header>
  );
}
