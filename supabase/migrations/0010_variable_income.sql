-- NZX P4: variable monthly income. A per-month actual override for income sources flagged
-- variable, plus the flag itself. Additive + idempotent (expand-contract safe): re-runs
-- cleanly so `deploy-dev`'s `supabase db push` stays green even if applied out-of-band first.

-- The flag that turns an income source into a variable one (the override editor only shows
-- for these). Non-variable sources always use their base amount.
alter table public.incomes add column if not exists is_variable boolean not null default false;

-- One actual-amount override per (income, billing month). The amount substitutes the income's
-- base `amount` for that month (the planner still applies the cadence multiplier). Owner-only RLS.
create table if not exists public.income_overrides (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.profiles (id) on delete cascade,
  income_id     uuid not null references public.incomes (id) on delete cascade,
  billing_month date not null,
  amount        numeric(14, 2) not null check (amount >= 0),
  created_at    timestamptz not null default now(),
  unique (income_id, billing_month)
);

create index if not exists income_overrides_profile_month_idx
  on public.income_overrides (profile_id, billing_month);

alter table public.income_overrides enable row level security;

drop policy if exists "income_overrides_owner_all" on public.income_overrides;
create policy "income_overrides_owner_all" on public.income_overrides
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
