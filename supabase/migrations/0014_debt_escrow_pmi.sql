-- NZX P4: principal/interest/escrow accounting. A debt payment's total is split so only the
-- principal reduces the balance; the rest is interest + (mortgage) optional escrow + PMI.
--   * debts.escrow / debts.pmi — optional monthly amounts (null ⇒ $0), excluded from principal.
--   * transactions.interest / transactions.principal — the split recorded when a payment is
--     checked off (Phase 5); null on charges/contributions and legacy payments. `amount`
--     stays the full payment.
-- All additive + nullable (expand-contract safe). RLS already scopes both tables to the owner.
alter table public.debts add column if not exists escrow numeric(14, 2) check (escrow >= 0);
alter table public.debts add column if not exists pmi    numeric(14, 2) check (pmi >= 0);

alter table public.transactions add column if not exists interest  numeric(14, 2) check (interest >= 0);
alter table public.transactions add column if not exists principal numeric(14, 2) check (principal >= 0);
