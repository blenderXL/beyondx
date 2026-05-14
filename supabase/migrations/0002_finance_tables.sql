-- NZX v1.0 finance schema stubs. Tables are defined now so v1.1 doesn't need migrations.
-- All money fields are numeric(14,2) — USD only in v1.x.

create type public.debt_type as enum ('credit_card', 'loan', 'mortgage', 'student', 'auto', 'medical', 'other');
create type public.income_cadence as enum ('weekly', 'biweekly', 'semimonthly', 'monthly', 'annual', 'one_time');
create type public.expense_cadence as enum ('weekly', 'biweekly', 'monthly', 'quarterly', 'annual', 'one_time');
create type public.plan_strategy as enum ('snowball', 'avalanche', 'custom');

create table public.debts (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  name         text not null,
  type         public.debt_type not null default 'other',
  balance      numeric(14, 2) not null check (balance >= 0),
  apr          numeric(6, 4) not null default 0 check (apr >= 0),
  min_payment  numeric(14, 2) not null default 0 check (min_payment >= 0),
  due_day      smallint check (due_day between 1 and 31),
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.accounts (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  name        text not null,
  kind        text not null default 'checking',
  balance     numeric(14, 2) not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.incomes (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  source      text not null,
  amount      numeric(14, 2) not null check (amount >= 0),
  cadence     public.income_cadence not null default 'monthly',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.expenses (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  category    text not null,
  amount      numeric(14, 2) not null check (amount >= 0),
  cadence     public.expense_cadence not null default 'monthly',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.plans (
  id                uuid primary key default gen_random_uuid(),
  profile_id        uuid not null references public.profiles (id) on delete cascade,
  name              text not null default 'My plan',
  strategy          public.plan_strategy not null default 'avalanche',
  monthly_budget    numeric(14, 2) not null check (monthly_budget >= 0),
  starts_on         date not null default current_date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table public.plan_runs (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references public.plans (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  result      jsonb not null,
  created_at  timestamptz not null default now()
);

-- Touch triggers
create trigger debts_set_updated_at      before update on public.debts      for each row execute function public.touch_updated_at();
create trigger accounts_set_updated_at   before update on public.accounts   for each row execute function public.touch_updated_at();
create trigger incomes_set_updated_at    before update on public.incomes    for each row execute function public.touch_updated_at();
create trigger expenses_set_updated_at   before update on public.expenses   for each row execute function public.touch_updated_at();
create trigger plans_set_updated_at      before update on public.plans      for each row execute function public.touch_updated_at();

-- Indexes
create index debts_profile_idx     on public.debts     (profile_id) where archived_at is null;
create index accounts_profile_idx  on public.accounts  (profile_id);
create index incomes_profile_idx   on public.incomes   (profile_id);
create index expenses_profile_idx  on public.expenses  (profile_id);
create index plans_profile_idx     on public.plans     (profile_id);
create index plan_runs_plan_idx    on public.plan_runs (plan_id);

-- Row Level Security: every row scoped to the owning profile.
alter table public.debts      enable row level security;
alter table public.accounts   enable row level security;
alter table public.incomes    enable row level security;
alter table public.expenses   enable row level security;
alter table public.plans      enable row level security;
alter table public.plan_runs  enable row level security;

create policy "debts_owner_all"     on public.debts      for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "accounts_owner_all"  on public.accounts   for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "incomes_owner_all"   on public.incomes    for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "expenses_owner_all"  on public.expenses   for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "plans_owner_all"     on public.plans      for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "plan_runs_owner_all" on public.plan_runs  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
