-- NZX: wire the reserved transaction FKs (expenses + savings_goals now exist) and an
-- index for the planner's "paid this month" lookups. Additive + idempotent.

-- expense_id / savings_goal_id were reserved nullable in 0003; add their FKs now.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'transactions_expense_id_fkey') then
    alter table public.transactions
      add constraint transactions_expense_id_fkey
      foreign key (expense_id) references public.expenses (id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'transactions_savings_goal_id_fkey') then
    alter table public.transactions
      add constraint transactions_savings_goal_id_fkey
      foreign key (savings_goal_id) references public.savings_goals (id) on delete cascade;
  end if;
end $$;

-- The planner asks "which items did I pay in billing-month M?" — index payments by
-- profile + billing month.
create index if not exists transactions_paid_idx
  on public.transactions (profile_id, billing_month)
  where kind = 'payment';
