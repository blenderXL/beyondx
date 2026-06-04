-- NZX P5: debt enhancements. An optional loan start date for installment debts (the user
-- can set the original balance + when the loan began, for "% paid off" context). Additive +
-- idempotent (expand-contract safe). `original_balance` already exists (0003); P5 just makes
-- it user-editable in the app — no schema change needed for that.
alter table public.debts add column if not exists start_date date;
