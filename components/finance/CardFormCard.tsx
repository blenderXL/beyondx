"use client";

import { useActionState, useEffect, useState } from "react";
import { Banknote, CreditCard, type LucideIcon } from "lucide-react";
import { createCard, updateCard } from "@/app/(app)/actions";
import { INITIAL_FINANCE_STATE } from "@/lib/finance/actionState";
import { CARD_TYPES, CARD_TYPE_LABELS, type Card, type CardType } from "@/lib/finance/types";
import {
  inputClass,
  labelClass,
  primaryButtonClass,
  ghostButtonClass,
  errorClass,
} from "@/components/finance/formStyles";

interface Props {
  /** When present the form edits this card; otherwise it creates a new one. */
  card?: Card;
  onDone: () => void;
  onCancel: () => void;
}

const TYPE_ICON: Record<CardType, LucideIcon> = { credit: CreditCard, debit: Banknote };

/**
 * Add/edit a payment card (migration 0021). Minimal by design — a name and a credit/debit
 * toggle. Mirrors the finance-form pattern: `useActionState` + close on `state.ok`.
 */
export function CardFormCard({ card, onDone, onCancel }: Props) {
  const editing = Boolean(card);
  const [cardType, setCardType] = useState<CardType>(card?.card_type ?? "credit");
  const [state, formAction, pending] = useActionState(
    editing ? updateCard : createCard,
    INITIAL_FINANCE_STATE,
  );

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form
      action={formAction}
      className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-6"
    >
      <div className="mb-6">
        <p className={labelClass}>// {editing ? "edit card" : "new card"}</p>
        <h2 className="mt-2 font-sans text-xl font-medium text-[var(--color-text-primary)]">
          {editing ? card!.name : "Add a payment card"}
        </h2>
        <p className="mt-1 font-mono text-[11px] text-[var(--color-text-muted)]">
          // tag expenses with the card you pay them on
        </p>
      </div>

      {editing ? <input type="hidden" name="id" value={card!.id} /> : null}
      <input type="hidden" name="card_type" value={cardType} />

      <label className="block">
        <span className={labelClass}>Card name</span>
        <input
          type="text"
          name="name"
          aria-label="Card name"
          required
          maxLength={120}
          defaultValue={card?.name}
          placeholder="Amex, Chase debit…"
          className={inputClass}
        />
      </label>

      <div className="mt-4">
        <span className={labelClass}>Type</span>
        <div role="group" aria-label="Card type" className="mt-2 grid grid-cols-2 gap-2">
          {CARD_TYPES.map((t) => {
            const Icon = TYPE_ICON[t];
            const active = cardType === t;
            return (
              <button
                key={t}
                type="button"
                aria-pressed={active}
                onClick={() => setCardType(t)}
                className={`flex h-11 items-center justify-center gap-2 rounded-md border font-mono text-xs uppercase tracking-[0.18em] transition-colors ${
                  active
                    ? "border-[var(--color-text-primary)] text-[var(--color-text-primary)]"
                    : "border-[var(--color-border-strong)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                }`}
              >
                <Icon className="size-4" aria-hidden />
                {CARD_TYPE_LABELS[t]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? "Saving…" : editing ? "Save card" : "Add card"}
        </button>
        <button type="button" onClick={onCancel} className={ghostButtonClass}>
          Cancel
        </button>
      </div>

      {state.error ? (
        <p role="alert" className={`mt-4 ${errorClass}`}>
          // {state.error}
        </p>
      ) : null}
    </form>
  );
}
