-- NZX M1: link an expense to a debt so paying the expense (in the Budget/planner) can
-- draw down that debt's balance. Additive + idempotent (expand-contract safe): a new
-- nullable column + index, so the previous app version keeps working and a rollback is safe.

-- `on delete set null`: if a debt is ever hard-deleted, the expense survives (just unlinks).
-- The existing owner-only RLS policy on `expenses` already covers this column. Ownership of
-- the referenced debt is enforced in the server action (it can only link a debt RLS returns).
alter table public.expenses
  add column if not exists debt_id uuid references public.debts (id) on delete set null;

create index if not exists expenses_debt_id_idx on public.expenses (debt_id)
  where debt_id is not null;
