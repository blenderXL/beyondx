-- NZX P3: offerings/tithing move from an income setting to an EXPENSE group, so there is a
-- single source of truth (and the planner no longer double-counts once both exist).
-- Additive + idempotent (expand-contract): a new nullable column + a guarded one-time fold.
-- The income tithe columns are retired (app stops reading them) but kept for one release.

alter table public.expenses
  add column if not exists pct_of_income numeric(6, 4) check (pct_of_income >= 0 and pct_of_income <= 100);

-- One-time fold: each active income that has a tithe becomes an "Offering" expense. Percent
-- titles carry pct_of_income; fixed titles are normalized to a monthly amount (the planner
-- reads expenses monthly). Idempotent: skip a profile that already has an offering expense.
do $$
declare
  inc record;
  monthly_fixed numeric(14, 2);
  factor numeric;
begin
  for inc in
    select * from public.incomes
    where archived_at is null and tithe_mode <> 'none' and tithe_value is not null
  loop
    if exists (
      select 1 from public.expenses e
      where e.profile_id = inc.profile_id and e.expense_group = 'offering'
    ) then
      continue;
    end if;

    factor := case inc.cadence
      when 'weekly' then 52.0 / 12
      when 'biweekly' then 26.0 / 12
      when 'semimonthly' then 2
      when 'monthly' then 1
      when 'annual' then 1.0 / 12
      else 0 end;
    monthly_fixed := round(coalesce(inc.tithe_value, 0) * factor, 2);

    insert into public.expenses (profile_id, category, amount, cadence, expense_group, pct_of_income, due_day)
    values (
      inc.profile_id,
      'Offering',
      case when inc.tithe_mode = 'fixed' then monthly_fixed else 0 end,
      'monthly',
      'offering',
      case when inc.tithe_mode = 'percent' then inc.tithe_value else null end,
      inc.pay_day
    );
  end loop;
end $$;
