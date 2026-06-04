"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Open/closed state for the mobile navigation drawer. Mirrors `ThemeProvider`'s shape.
 * The drawer is only visible below `md`; on desktop the sidebar is a static rail and this
 * state is effectively unused. Side effects (Esc-to-close, scroll lock) only attach while
 * the drawer is open and are torn down on close/unmount so nothing leaks.
 */
interface SidebarContextValue {
  open: boolean;
  toggle: () => void;
  close: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  // Close on navigation (tapping a nav item should dismiss the drawer).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Esc closes — listener attached only while open, removed on close/unmount.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Lock body scroll while the drawer is open; always restore the prior value.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return <SidebarContext.Provider value={{ open, toggle, close }}>{children}</SidebarContext.Provider>;
}

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}
