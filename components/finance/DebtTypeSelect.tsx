"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronsUpDown, Check } from "lucide-react";
import { DEBT_TYPES, DEBT_TYPE_LABELS, type DebtType } from "@/lib/finance/types";
import { DebtTypeIcon } from "@/components/finance/DebtTypeIcon";
import { inputClass } from "@/components/finance/formStyles";

interface Props {
  value: DebtType;
  onChange: (t: DebtType) => void;
  /** Hidden-input name so the value submits with the surrounding form. */
  name?: string;
  ariaLabel?: string;
}

/**
 * Accessible icon dropdown (ARIA listbox) for the debt type — renders each option's
 * vector icon inline, which a native <select> can't do. Keyboard: ↑/↓ move, Enter/Space
 * select, Esc closes, Home/End jump; click-outside closes; focus returns to the trigger.
 * A hidden <input name> carries the value so it submits with the form like the old select.
 */
export function DebtTypeSelect({ value, onChange, name = "type", ariaLabel = "Type of debt" }: Props) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, DEBT_TYPES.indexOf(value)));
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const baseId = useId();
  const optionId = (i: number) => `${baseId}-opt-${i}`;

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  // On open: focus the listbox, sync the active option to the current value.
  useEffect(() => {
    if (open) {
      setActiveIndex(Math.max(0, DEBT_TYPES.indexOf(value)));
      listRef.current?.focus();
    }
  }, [open, value]);

  // Keep the active option scrolled into view.
  useEffect(() => {
    if (open) document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeIndex]);

  function close(focusTrigger = true) {
    setOpen(false);
    if (focusTrigger) buttonRef.current?.focus();
  }

  function commit(i: number) {
    const t = DEBT_TYPES[i];
    if (t) onChange(t);
    close();
  }

  function onTriggerKeyDown(e: React.KeyboardEvent) {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      setOpen(true);
    }
  }

  function onListKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(DEBT_TYPES.length - 1, i + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
        break;
      case "Home":
        e.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        e.preventDefault();
        setActiveIndex(DEBT_TYPES.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        commit(activeIndex);
        break;
      case "Escape":
        e.preventDefault();
        close();
        break;
      case "Tab":
        close(false); // let focus move naturally
        break;
      default:
        break;
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <input type="hidden" name={name} value={value} />
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
        className={`${inputClass.replace("block", "flex")} cursor-pointer items-center justify-between gap-2 text-left`}
      >
        <span className="flex items-center gap-2 truncate">
          <DebtTypeIcon type={value} className="size-4 shrink-0 text-[var(--color-text-secondary)]" />
          <span className="truncate">{DEBT_TYPE_LABELS[value]}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-[var(--color-text-muted)]" aria-hidden />
      </button>

      {open ? (
        <ul
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          aria-label={ariaLabel}
          aria-activedescendant={optionId(activeIndex)}
          onKeyDown={onListKeyDown}
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] p-1 shadow-lg outline-none"
        >
          {DEBT_TYPES.map((t, i) => {
            const selected = t === value;
            const active = i === activeIndex;
            return (
              <li
                key={t}
                id={optionId(i)}
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => commit(i)}
                className={`flex cursor-pointer items-center gap-2 rounded px-2 py-2 font-mono text-sm ${
                  active
                    ? "bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                    : "text-[var(--color-text-secondary)]"
                }`}
              >
                <DebtTypeIcon type={t} className="size-4 shrink-0" />
                <span className="flex-1 truncate">{DEBT_TYPE_LABELS[t]}</span>
                {selected ? (
                  <Check className="size-4 shrink-0 text-[var(--color-accent-emerald)]" aria-hidden />
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
