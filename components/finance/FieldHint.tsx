"use client";

import { useId, useState } from "react";
import { Info } from "lucide-react";

/**
 * Small info-icon shown next to a form-field label. Reveals a short description on
 * hover AND keyboard focus (and tap, for touch). Self-contained accessibility: the
 * trigger is a real `<button>` whose `aria-describedby` points at a `role="tooltip"`
 * node, so screen readers announce the hint without any per-input wiring.
 *
 * IMPORTANT: this renders inside a `<label>`, so a hinted field's input/select MUST
 * carry an explicit `aria-label` — otherwise this button's name would pollute the
 * control's accessible name (see the form-label-pollution fix).
 */
export function FieldHint({ text }: { text: string; label?: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);

  // Accessible name is the generic "More information" (NOT the field name) so it never
  // collides with `getByLabel(fieldName)` in tests or with the input's own accessible name.
  return (
    <span className="relative ml-1 inline-flex align-middle">
      <button
        type="button"
        aria-label="More information"
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          // Inside a <label>: don't let a tap fall through to focus the input.
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="inline-flex items-center text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-secondary)] focus-visible:text-[var(--color-text-secondary)] focus:outline-none"
      >
        <Info className="size-3" aria-hidden />
      </button>
      {open ? (
        <span
          role="tooltip"
          id={id}
          className="absolute bottom-full left-1/2 z-30 mb-1.5 w-48 -translate-x-1/2 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] px-2.5 py-1.5 font-sans text-[11px] leading-snug font-normal normal-case tracking-normal text-[var(--color-text-secondary)] shadow-lg"
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}
