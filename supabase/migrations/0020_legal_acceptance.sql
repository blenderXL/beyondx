-- NZX legal acknowledgment: record which version of the Terms/Privacy/Disclaimer each user has
-- accepted, so the first-login consent gate can require (re-)acceptance when the version changes.
-- Additive + idempotent (expand-contract safe). Two parts:
--   1. denormalized columns on profiles for the fast gate check (null = not yet accepted);
--   2. an append-only audit table capturing every acceptance (version + timestamp + ip + ua).

alter table public.profiles
  add column if not exists accepted_legal_version text,
  add column if not exists accepted_legal_at timestamptz;

create table if not exists public.legal_acceptances (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  version     text not null,
  documents   text[] not null default '{}',
  ip          text,
  user_agent  text,
  accepted_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index if not exists legal_acceptances_profile_idx on public.legal_acceptances (profile_id);

alter table public.legal_acceptances enable row level security;

-- Owner-only, append-only: a user can read and insert their own acceptance rows. No update/delete
-- policy — the audit trail is immutable from the app's perspective.
drop policy if exists "legal_acceptances_select_own" on public.legal_acceptances;
create policy "legal_acceptances_select_own"
  on public.legal_acceptances for select
  using (profile_id = auth.uid());

drop policy if exists "legal_acceptances_insert_own" on public.legal_acceptances;
create policy "legal_acceptances_insert_own"
  on public.legal_acceptances for insert
  with check (profile_id = auth.uid());
