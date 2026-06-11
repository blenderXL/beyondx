-- NZX Round 4: a recurring savings contribution can be a percent of monthly income instead of
-- a fixed dollar amount (mirrors the offering expense's pct_of_income, migration 0009). When set,
-- the pot shows on Expenses as a checkable bill whose amount = pct × total monthly income.
-- A pot uses EITHER monthly_contribution (fixed) OR pct_of_income (percent), never both — the app
-- enforces the exclusivity; the column is just additive. Nullable, additive + idempotent
-- (expand-contract safe); RLS already scopes the table to the owner.
alter table public.savings_goals
  add column if not exists pct_of_income numeric(6, 4) check (pct_of_income >= 0 and pct_of_income <= 100);
