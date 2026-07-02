-- Per-income payment cards for a percent-of-income offering: a 10% tithe over three
-- paychecks is really three slices, and each slice can be paid with a different card.
-- One row per (expense, income); card_id null = that slice is unassigned. All additive
-- (new table only) → single-release-safe.

create table if not exists public.expense_income_cards (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  expense_id  uuid not null references public.expenses (id) on delete cascade,
  income_id   uuid not null references public.incomes (id) on delete cascade,
  card_id     uuid references public.cards (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (profile_id, expense_id, income_id)
);

create trigger expense_income_cards_set_updated_at before update on public.expense_income_cards
  for each row execute function public.touch_updated_at();

create index expense_income_cards_expense_idx on public.expense_income_cards (profile_id, expense_id);

alter table public.expense_income_cards enable row level security;

create policy "expense_income_cards_owner_all" on public.expense_income_cards
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
