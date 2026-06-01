-- NZX v1.1 Phase 1: Debt management.
-- Extends `debts` with the fields a real account needs and adds a `transactions`
-- ledger (charges raise a balance, payments lower it). Additive + idempotent
-- (expand-contract safe): every statement can re-run without error, so `deploy-dev`'s
-- `supabase db push` stays green even if these objects were applied to nzx-dev
-- out-of-band (e.g. via the management API before this branch merged).

-- 1. Real-account fields on debts. All nullable except the boolean flag (defaulted).
alter table public.debts add column if not exists credit_limit      numeric(14, 2) check (credit_limit >= 0);
alter table public.debts add column if not exists original_balance  numeric(14, 2) check (original_balance >= 0);
alter table public.debts add column if not exists issuer            text;
alter table public.debts add column if not exists promo_apr         numeric(6, 4) check (promo_apr >= 0);
alter table public.debts add column if not exists promo_until       date;
alter table public.debts add column if not exists deferred_interest boolean not null default false;
alter table public.debts add column if not exists payoff_order      smallint;
alter table public.debts add column if not exists notes             text;

-- 2. Transactions ledger. Append-only (no updated_at). `expense_id` / `savings_goal_id`
-- are reserved for Phase 2 — their FKs are added when those tables/UI land.
create table if not exists public.transactions (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid not null references public.profiles (id) on delete cascade,
  debt_id          uuid references public.debts (id) on delete cascade,
  expense_id       uuid,
  savings_goal_id  uuid,
  kind             text not null check (kind in ('charge', 'payment', 'contribution')),
  amount           numeric(14, 2) not null check (amount > 0),
  occurred_on      date not null default current_date,
  billing_month    date,
  note             text,
  created_at       timestamptz not null default now()
);

create index if not exists transactions_profile_idx on public.transactions (profile_id);
create index if not exists transactions_debt_idx    on public.transactions (debt_id) where debt_id is not null;

-- Row Level Security: every row scoped to the owning profile.
alter table public.transactions enable row level security;

drop policy if exists "transactions_owner_all" on public.transactions;
create policy "transactions_owner_all" on public.transactions
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
