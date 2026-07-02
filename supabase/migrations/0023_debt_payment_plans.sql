-- Planned per-month debt payments: clicking a current-month amount in the payoff
-- planner's month-by-month table saves it here, and the Expenses page pre-fills that
-- debt's bill with it (instead of the bare minimum). One row per debt per billing
-- month. All additive (new table only) → single-release-safe.

create table if not exists public.debt_payment_plans (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.profiles (id) on delete cascade,
  debt_id       uuid not null references public.debts (id) on delete cascade,
  billing_month date not null,
  amount        numeric(14,2) not null check (amount >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (profile_id, debt_id, billing_month)
);

create trigger debt_payment_plans_set_updated_at before update on public.debt_payment_plans
  for each row execute function public.touch_updated_at();

create index debt_payment_plans_month_idx on public.debt_payment_plans (profile_id, billing_month);

alter table public.debt_payment_plans enable row level security;

create policy "debt_payment_plans_owner_all" on public.debt_payment_plans
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
