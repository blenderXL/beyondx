/**
 * Shared Tailwind class strings for the finance forms, so every input/button matches
 * the auth surface (mono labels, elevated inputs, CSS-variable tokens) without copying
 * the long class lists into each component.
 */

export const labelClass =
  "font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]";

export const inputClass =
  "mt-2 block h-11 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] px-3 font-mono text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-text-primary)]";

// Native date inputs render their value top-aligned in WebKit; flex + items-center
// vertically centers the datetime text so it matches the other fields.
export const dateInputClass = inputClass.replace("block", "flex items-center");

export const textareaClass =
  "mt-2 block min-h-20 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] px-3 py-2 font-mono text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-text-primary)]";

export const primaryButtonClass =
  "flex h-11 items-center justify-center rounded-md bg-[var(--color-text-primary)] px-5 font-mono text-xs tracking-[0.18em] text-[var(--color-canvas)] uppercase transition-opacity hover:opacity-90 disabled:opacity-60";

export const ghostButtonClass =
  "flex h-11 items-center justify-center rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] px-5 font-mono text-xs tracking-[0.18em] text-[var(--color-text-primary)] uppercase transition-colors hover:border-[var(--color-text-primary)] disabled:opacity-60";

export const errorClass = "font-mono text-xs text-[var(--color-accent-red)]";
