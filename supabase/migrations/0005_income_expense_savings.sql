-- NZX Phase 2: ledger spine cont. — income tithe + pay-day, expense grouping,
-- savings pots. Additive + idempotent (expand-contract safe): re-runs cleanly so
-- `deploy-dev`'s `supabase db push` stays green even if applied out-of-band first.

-- 1. incomes: configurable tithe (none/percent/fixed), the day-of-month the paycheck
--    lands (so the planner can split 1st vs 15th), and soft-delete.
alter table public.incomes add column if not exists tithe_mode  text not null default 'none'
  check (tithe_mode in ('none', 'percent', 'fixed'));
alter table public.incomes add column if not exists tithe_value numeric(14, 4) check (tithe_value >= 0);
alter table public.incomes add column if not exists pay_day     smallint check (pay_day between 1 and 31);
alter table public.incomes add column if not exists archived_at timestamptz;

-- 2. expenses: rollup group (utility/insurance/…), specific payee, due day, soft-delete.
alter table public.expenses add column if not exists expense_group text;
alter table public.expenses add column if not exists payee         text;
alter table public.expenses add column if not exists due_day       smallint check (due_day between 1 and 31);
alter table public.expenses add column if not exists archived_at   timestamptz;

-- 3. savings pots ("Purge"): named, optional target, current balance. Owner-only RLS.
create table if not exists public.savings_goals (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references public.profiles (id) on delete cascade,
  name            text not null,
  target_amount   numeric(14, 2) check (target_amount >= 0),
  current_amount  numeric(14, 2) not null default 0 check (current_amount >= 0),
  archived_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists savings_goals_profile_idx on public.savings_goals (profile_id) where archived_at is null;

alter table public.savings_goals enable row level security;

drop policy if exists "savings_goals_owner_all" on public.savings_goals;
create policy "savings_goals_owner_all" on public.savings_goals
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop trigger if exists savings_goals_set_updated_at on public.savings_goals;
create trigger savings_goals_set_updated_at before update on public.savings_goals
  for each row execute function public.touch_updated_at();
