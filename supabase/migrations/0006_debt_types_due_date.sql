-- NZX: richer debt types + a real Next Due Date. Additive + idempotent
-- (expand-contract safe): re-runs cleanly so `deploy-dev`'s `supabase db push`
-- stays green even if applied out-of-band first.

-- 1. New debt_type values (PG12+ supports IF NOT EXISTS; not used in this migration,
--    so safe to add alongside the column change). Existing values stay — relabeled in
--    the UI, never dropped.
alter type public.debt_type add value if not exists 'personal_loan';
alter type public.debt_type add value if not exists 'home_equity';
alter type public.debt_type add value if not exists 'loan_401k';
alter type public.debt_type add value if not exists 'savings_club';

-- 2. Next Due Date as a real date. Nullable; `due_day` (smallint) is retained for
--    back-compat (the planner reads next_due_date first, falling back to due_day).
alter table public.debts add column if not exists next_due_date date;
