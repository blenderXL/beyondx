-- NZX P6: savings pots gain a type (Roth IRA, HSA, Apple Cash, Brokerage, Christmas Club,
-- Emergency, General). Nullable text — the app treats a null/absent type as "general".
-- Additive + idempotent (expand-contract safe). Contributions ride the existing transactions
-- table (savings_goal_id + kind='contribution'); no schema change needed for those.
alter table public.savings_goals add column if not exists type text;
