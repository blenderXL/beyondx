"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { IdentifyUser } from "@/components/telemetry/IdentifyUser";
import { useSidebar } from "@/components/layout/SidebarProvider";
import type { FlagKey } from "@/lib/flags/registry";

interface Props {
  userId: string;
  enabledFlags?: Partial<Record<FlagKey, boolean>>;
  email: string | null;
  displayName: string | null;
  tier: "free" | "pro";
  children: React.ReactNode;
}

const DRAWER_ID = "app-nav-drawer";

/**
 * Responsive app shell. On `md+` it's the original fixed two-column grid (static sidebar +
 * scrollable main). Below `md` the sidebar becomes an off-canvas drawer with a backdrop, the
 * root switches to `min-h-dvh` block flow (no `overflow-hidden`, so the page scrolls to the
 * bottom — the mobile clip bug), and the TopBar exposes a hamburger.
 *
 * The static rail and the drawer each render `<Sidebar>` but are mutually `hidden` across the
 * `md` breakpoint, so exactly one is in the accessibility tree at a time.
 */
export function AppShell({ userId, enabledFlags, email, displayName, tier, children }: Props) {
  const { open, close } = useSidebar();
  const drawerRef = useRef<HTMLDivElement>(null);

  // Move focus into the drawer on open; restore it to the trigger on close.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    drawerRef.current?.focus();
    return () => previouslyFocused?.focus?.();
  }, [open]);

  return (
    <div className="min-h-dvh bg-[var(--color-canvas)] md:grid md:h-screen md:grid-cols-[15rem_1fr] md:overflow-hidden">
      <IdentifyUser userId={userId} />

      {/* Static rail — desktop only */}
      <div className="hidden md:block">
        <Sidebar enabledFlags={enabledFlags} />
      </div>

      {/* Off-canvas drawer + backdrop — mobile only */}
      <div className="md:hidden">
        <div
          aria-hidden
          onClick={close}
          className={cn(
            "fixed inset-0 z-40 bg-black/60 transition-opacity duration-200",
            open ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        />
        <div
          id={DRAWER_ID}
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          tabIndex={-1}
          inert={!open}
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-60 outline-none transition-transform duration-200 ease-out",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <Sidebar enabledFlags={enabledFlags} />
        </div>
      </div>

      {/* Main column */}
      <div className="flex min-h-dvh flex-col md:grid md:min-h-0 md:grid-rows-[auto_1fr] md:overflow-hidden">
        <TopBar email={email} displayName={displayName} tier={tier} drawerId={DRAWER_ID} />
        <main className="flex-1 px-4 py-6 sm:px-8 sm:py-8 md:overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
