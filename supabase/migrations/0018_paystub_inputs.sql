-- Paycheck calculator: remember the user's last inputs (one row per profile) so the form is
-- pre-filled next visit. The estimate itself is computed client-side; this only persists inputs.
-- Additive + RLS-scoped (owner-only). Self-contained — droppable if the page is removed.

create table public.paystub_inputs (
  profile_id  uuid primary key references public.profiles (id) on delete cascade,
  inputs      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger paystub_inputs_set_updated_at
  before update on public.paystub_inputs
  for each row execute function public.touch_updated_at();

alter table public.paystub_inputs enable row level security;

create policy "paystub_inputs_owner_all" on public.paystub_inputs
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
