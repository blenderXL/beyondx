-- Payment cards (experiment): let a user register credit/debit cards and tag each
-- expense with the card they plan to pay it with, so the Expenses page can total
-- planned spend per card. All additive → single-release-safe (new type, new table,
-- one nullable FK column). No existing column is dropped or rewritten.

create type public.card_type as enum ('credit', 'debit');

create table if not exists public.cards (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  name        text not null,
  card_type   public.card_type not null default 'credit',
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger cards_set_updated_at before update on public.cards
  for each row execute function public.touch_updated_at();

create index cards_profile_idx on public.cards (profile_id) where archived_at is null;

alter table public.cards enable row level security;

create policy "cards_owner_all" on public.cards
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- The card an expense is paid with. Nullable = unassigned; on delete set null so a
-- (hard) card delete never orphans an expense. Archiving a card is a soft-delete, so
-- the FK stays valid and the UI treats an archived card as unassigned.
alter table public.expenses
  add column if not exists card_id uuid references public.cards (id) on delete set null;
