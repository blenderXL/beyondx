import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardClient, type AgendaItem } from "@/components/finance/DashboardClient";
import { buildMonthlyPlan, monthlyAmount, type PlannerDebt } from "@/lib/finance/planner";
import { expenseDisplayAmount } from "@/lib/finance/derive";
import { computePayoff, resolvePayoffMethod, type PayoffDebtInput } from "@/lib/finance/payoff";
import type { Debt, Expense, Income, SavingsGoal } from "@/lib/finance/types";

export const dynamic = "force-dynamic";

export default async function AppDashboard() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const greetingName =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    (user.email ? user.email.split("@")[0] : "there");

  const now = new Date();
  const billingMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;

  const [debtsRes, expensesRes, savingsRes, incomesRes, paymentsRes, contribRes, overridesRes, profileRes] =
    await Promise.all([
      supabase.from("debts").select("*").is("archived_at", null).order("name", { ascending: true }),
      supabase.from("expenses").select("*").is("archived_at", null).order("created_at", { ascending: true }),
      supabase.from("savings_goals").select("*").is("archived_at", null).order("name", { ascending: true }),
      supabase.from("incomes").select("*").is("archived_at", null),
      supabase.from("transactions").select("expense_id, debt_id").eq("kind", "payment").eq("billing_month", billingMonth),
      supabase.from("transactions").select("savings_goal_id").eq("kind", "contribution").eq("billing_month", billingMonth),
      supabase.from("income_overrides").select("income_id, amount").eq("billing_month", billingMonth),
      // select("*") is pre-migration-safe for payoff_method (0013) + payoff_budget (0016).
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    ]);

  const debtRows = (debtsRes.data ?? []) as Debt[];
  const expenses = (expensesRes.data ?? []) as Expense[];
  const savingsRows = (savingsRes.data ?? []) as SavingsGoal[];
  const incomes = (incomesRes.data ?? []) as Income[];

  const payments = (paymentsRes.data ?? []) as { expense_id: string | null; debt_id: string | null }[];
  const paidExpenseIds = new Set(payments.map((t) => t.expense_id).filter((id): id is string => Boolean(id)));
  const paidDebtIds = new Set(payments.map((t) => t.debt_id).filter((id): id is string => Boolean(id)));
  const paidSavingsIds = new Set(
    ((contribRes.data ?? []) as { savings_goal_id: string | null }[])
      .map((t) => t.savings_goal_id)
      .filter((id): id is string => Boolean(id)),
  );

  const overrides: Record<string, number> = {};
  for (const o of (overridesRes.data ?? []) as { income_id: string; amount: number }[]) {
    overrides[o.income_id] = Number(o.amount);
  }

  const prof = profileRes.data as { payoff_method?: unknown; payoff_budget?: number | null } | null;
  const method = resolvePayoffMethod(prof?.payoff_method);
  const savedBudget = prof?.payoff_budget == null ? null : Number(prof.payoff_budget);

  // ---- Headline numbers ----
  const totalDebt = debtRows.reduce((s, d) => s + Number(d.balance), 0);
  const totalMin = debtRows.reduce((s, d) => s + Number(d.min_payment), 0);

  const payoffInput: PayoffDebtInput[] = debtRows.map((d) => ({
    id: d.id,
    name: d.name,
    balance: Number(d.balance),
    apr: Number(d.apr),
    min_payment: Number(d.min_payment),
  }));
  // Use the SAME budget the planner uses so both pages show the same payoff date: the value
  // the user saved, else the planner's default (minimums + $100).
  const budget = savedBudget ?? Math.max(Math.round(totalMin) + 100, Math.round(totalMin));
  const strategy = computePayoff(payoffInput, budget, method);
  const minOnly = computePayoff(payoffInput, Math.round(totalMin), method);
  const interestSaved =
    debtRows.length > 0 && strategy.feasible && minOnly.feasible
      ? Math.max(0, minOnly.totalInterest - strategy.totalInterest)
      : null;

  // ---- Monthly plan (targets + leftover) ----
  const linkedDebtIds = new Set(expenses.map((e) => e.debt_id).filter((id): id is string => Boolean(id)));
  const plan = buildMonthlyPlan({
    incomes,
    expenses,
    overrides,
    debts: debtRows
      .filter((d) => !linkedDebtIds.has(d.id))
      .map<PlannerDebt>((d) => ({
        id: d.id,
        name: d.name,
        min_payment: Number(d.min_payment),
        due_day: d.next_due_date ? new Date(`${d.next_due_date}T00:00:00Z`).getUTCDate() : d.due_day,
      })),
  });
  const outflow = Math.round(plan.offerings + plan.expenses + plan.savings + plan.debtMinimums);

  // ---- Today's agenda: every still-unpaid obligation this month ----
  const agenda: AgendaItem[] = [];
  for (const e of expenses) {
    if (paidExpenseIds.has(e.id)) continue;
    agenda.push({
      kind: "expense",
      id: e.id,
      name: e.category,
      amount: expenseDisplayAmount(e, plan.income),
      dueDay: e.due_day,
    });
  }
  for (const d of debtRows) {
    if (linkedDebtIds.has(d.id) || Number(d.min_payment) <= 0 || paidDebtIds.has(d.id)) continue;
    agenda.push({
      kind: "debt",
      id: d.id,
      name: d.name,
      amount: Number(d.min_payment),
      dueDay: d.next_due_date ? new Date(`${d.next_due_date}T00:00:00Z`).getUTCDate() : d.due_day,
    });
  }
  for (const g of savingsRows) {
    if (g.monthly_contribution == null || Number(g.monthly_contribution) <= 0 || paidSavingsIds.has(g.id)) continue;
    agenda.push({
      kind: "savings",
      id: g.id,
      name: g.name,
      amount: Number(g.monthly_contribution),
      dueDay: null,
    });
  }
  // Soonest pay day first; undated obligations (savings, no due day) sort last.
  agenda.sort((a, b) => (a.dueDay ?? 99) - (b.dueDay ?? 99));

  // ---- Next inflow: nearest upcoming income pay day ----
  const today = now.getUTCDate();
  let nextInflow: { amount: number; inDays: number } | null = null;
  for (const inc of incomes) {
    if (inc.pay_day == null) continue;
    const inDays = inc.pay_day >= today ? inc.pay_day - today : inc.pay_day - today + 30;
    const amount = overrides[inc.id] ?? Number(inc.amount);
    if (!nextInflow || inDays < nextInflow.inDays) nextInflow = { amount, inDays };
  }

  const subs = expenses.filter((e) => e.expense_group === "subscription");
  const subsTotal = subs.reduce((s, e) => s + monthlyAmount(Number(e.amount), e.cadence), 0);

  return (
    <DashboardClient
      greetingName={greetingName}
      billingMonth={billingMonth}
      totalDebt={totalDebt}
      totalMin={totalMin}
      payoffMonths={strategy.feasible ? strategy.months : null}
      interestSaved={interestSaved}
      income={plan.income}
      outflow={outflow}
      offerings={plan.offerings}
      leftover={plan.leftover}
      subscriptionTotal={subsTotal}
      nextInflow={nextInflow}
      agenda={agenda}
    />
  );
}
