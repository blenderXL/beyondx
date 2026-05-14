-- NZX v1.0 init: profiles table mirrors auth.users 1:1, holds tier + billing fields
-- forward-compatible for v1.1 (Lemon Squeezy) and v1.2 (LLM quota).

create extension if not exists vector;

create type public.user_tier as enum ('free', 'pro');

create table public.profiles (
  id                                   uuid primary key references auth.users (id) on delete cascade,
  email                                text not null,
  display_name                         text,
  tier                                 public.user_tier not null default 'free',
  lemon_squeezy_customer_id            text,
  lemon_squeezy_subscription_id        text,
  subscription_status                  text,
  current_period_end                   timestamptz,
  assistant_messages_used_this_period  integer not null default 0,
  created_at                           timestamptz not null default now(),
  updated_at                           timestamptz not null default now()
);

create index profiles_lemon_customer_idx on public.profiles (lemon_squeezy_customer_id)
  where lemon_squeezy_customer_id is not null;

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Server-side insert via trigger only — no user-facing insert policy.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();
