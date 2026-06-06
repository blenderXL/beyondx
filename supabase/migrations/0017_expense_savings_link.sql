-- NZX redesign: let an expense be "paid toward savings" — an optional link to a savings goal,
-- mirroring the existing debt_id link. Paying such an expense records a contribution and bumps
-- the goal's current_amount (handled in the togglePaid / payAllExpenses actions). Nullable FK;
-- additive + idempotent (expand-contract safe). RLS already scopes expenses to the owner.
alter table public.expenses
  add column if not exists savings_goal_id uuid references public.savings_goals(id);
