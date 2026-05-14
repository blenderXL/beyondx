"use client";

import { useTheme } from "@/components/theme/ThemeProvider";

export function DayNightToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={!isDark}
      aria-label="Toggle day and night"
      className="group inline-flex select-none items-center gap-3 font-mono text-xs uppercase tracking-[0.18em] text-[var(--color-text-secondary)] outline-none"
    >
      <span aria-hidden className="hidden sm:inline">
        Day / Night
      </span>
      <span
        aria-hidden
        className="relative h-5 w-10 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-elevated)] transition-colors group-hover:border-[var(--color-text-secondary)] group-focus-visible:ring-2 group-focus-visible:ring-[var(--color-text-secondary)]"
      >
        <span
          className="absolute top-1/2 size-3.5 -translate-y-1/2 rounded-full bg-[var(--color-text-primary)] transition-[left] duration-300 ease-[cubic-bezier(.2,.7,.2,1)]"
          style={{ left: isDark ? "3px" : "calc(100% - 3px - 0.875rem)" }}
        />
      </span>
    </button>
  );
}
