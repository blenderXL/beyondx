-- Tag each debt with the payment card its monthly payment is made on (mostly debit, sometimes
-- credit), so debt payments roll into the per-card totals like expenses do. Additive → single-
-- release-safe (one nullable FK column; on delete set null so removing a card doesn't orphan a debt).

alter table public.debts
  add column if not exists card_id uuid references public.cards (id) on delete set null;
