-- NZX P5B-3: savings pots gain an optional recurring monthly contribution. When set, the pot
-- shows on the Expenses page as a checkable bill; checking it off records a contribution and
-- bumps current_amount (the existing addContribution flow). Nullable (null/0 ⇒ not a recurring
-- bill). Additive + idempotent (expand-contract safe); RLS already scopes the table to the owner.
alter table public.savings_goals add column if not exists monthly_contribution numeric(14, 2) check (monthly_contribution >= 0);
