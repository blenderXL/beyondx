-- NZX Phase 1.6: release feature flags (interim runtime backend; PostHog later).
-- Additive + idempotent (expand-contract safe): every statement re-runs cleanly so
-- `deploy-dev`'s `supabase db push` stays green even if applied out-of-band first.
--
-- One global on/off per flag key. Flipped at release sign-off via the Supabase
-- dashboard / SQL (service_role) — NEVER by app users. Security model:
--   * RLS enabled.
--   * A single SELECT policy `using (true)` — anyone may READ flag state (it's
--     non-sensitive UI gating, and the anon-key server client must read it to gate
--     RSC/middleware before auth).
--   * NO insert/update/delete policy → those actions are denied by RLS default-deny
--     for anon AND authenticated. Only service_role (dashboard/SQL) can write. This
--     is the loophole-closing property: a customer cannot enable a hidden feature.
create table if not exists public.feature_flags (
  key          text primary key,
  enabled      boolean not null default false,
  rollout_pct  smallint not null default 100 check (rollout_pct between 0 and 100),
  audience     text,
  updated_at   timestamptz not null default now()
);

alter table public.feature_flags enable row level security;

drop policy if exists "feature_flags_read_all" on public.feature_flags;
create policy "feature_flags_read_all" on public.feature_flags
  for select using (true);

drop trigger if exists feature_flags_touch on public.feature_flags;
create trigger feature_flags_touch before update on public.feature_flags
  for each row execute function public.touch_updated_at();
