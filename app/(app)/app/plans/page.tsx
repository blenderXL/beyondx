import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { featureState } from "@/lib/flags/server";
import { ComingSoon } from "@/components/finance/ComingSoon";
import { PlansClient } from "@/components/finance/PlansClient";
import { resolvePayoffMethod, type PayoffDebtInput } from "@/lib/finance/payoff";
import { buildMonthlyPlan } from "@/lib/finance/planner";
import type { InsightDebt } from "@/lib/finance/insights";
import type { Debt, Expense, Income, SavingsGoal } from "@/lib/finance/types";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  // Gate A: hidden until the `payoffEngine` release flag is flipped on.
  const { visible } = await featureState("payoffEngine");
  if (!visible) return <ComingSoon title="Plans" />;

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Pre-migration-safe: select("*") never errors on a not-yet-added column (payoff_method 0013,
  // payoff_budget 0016), so the planner degrades to defaults until deploy-dev applies them.
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  const prof = profile as { payoff_method?: unknown; payoff_budget?: number | null } | null;
  const initialMethod = resolvePayoffMethod(prof?.payoff_method);
  const initialBudget = prof?.payoff_budget == null ? null : Number(prof.payoff_budget);

  const { data } = await supabase
    .from("debts")
    .select("id, name, type, balance, apr, min_payment, payoff_order, credit_limit")
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  const rows = (data ?? []) as Pick<
    Debt,
    "id" | "name" | "type" | "balance" | "apr" | "min_payment" | "payoff_order" | "credit_limit"
  >[];

  const debts: PayoffDebtInput[] = rows.map((d) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    balance: Number(d.balance),
    apr: Number(d.apr),
    min_payment: Number(d.min_payment),
    payoff_order: d.payoff_order,
  }));

  // Distribution/utilization math (merged in from the retired Insights page) needs type + limit.
  const insightDebts: InsightDebt[] = rows.map((d) => ({
    type: d.type,
    balance: Number(d.balance),
    apr: Number(d.apr),
    credit_limit: d.credit_limit === null ? null : Number(d.credit_limit),
  }));

  // Suggested monthly budget = every debt's minimum + this user's RECURRING surplus (income minus
  // recurring expenses, giving, savings, and debt minimums). Same math as the Expenses rail's
  // "budget left", but one-time items excluded so the multi-month projection stays stable. Lets the
  // planner pre-fill from real numbers instead of asking for a separate budget.
  const now = new Date();
  const billingMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const [incomesRes, expensesRes, savingsRes, overridesRes] = await Promise.all([
    supabase.from("incomes").select("*").is("archived_at", null),
    supabase.from("expenses").select("*").is("archived_at", null),
    supabase.from("savings_goals").select("*").is("archived_at", null),
    supabase.from("income_overrides").select("income_id, amount").eq("billing_month", billingMonth),
  ]);
  const incomes = (incomesRes.data ?? []) as Income[];
  const expenseRows = (expensesRes.data ?? []) as Expense[];
  const savingsRows = (savingsRes.data ?? []) as SavingsGoal[];
  const overrides: Record<string, number> = {};
  for (const o of (overridesRes.data ?? []) as { income_id: string; amount: number }[]) {
    overrides[o.income_id] = Number(o.amount);
  }

  // A debt whose payment is represented by a linked expense is dropped from debt minimums to avoid
  // double-counting (same as the Expenses page).
  const linkedDebtIds = new Set(expenseRows.map((e) => e.debt_id).filter((id): id is string => Boolean(id)));
  const recurringPlan = buildMonthlyPlan({
    incomes,
    expenses: expenseRows,
    overrides,
    recurringOnly: true,
    debts: rows
      .filter((d) => !linkedDebtIds.has(d.id))
      .map((d) => ({ id: d.id, name: d.name, min_payment: Number(d.min_payment), due_day: null })),
  });
  const effectiveSavingsMonthly = (g: SavingsGoal): number => {
    if (g.monthly_contribution != null && Number(g.monthly_contribution) > 0) return Number(g.monthly_contribution);
    if (g.pct_of_income != null && Number(g.pct_of_income) > 0) {
      return Math.round(((recurringPlan.income * Number(g.pct_of_income)) / 100) * 100) / 100;
    }
    return 0;
  };
  // Goals already represented by a savings-linked expense ride recurringPlan.savings instead —
  // drop them from the goal sum so the contribution isn't double-counted (same as linked debts).
  const linkedSavingsIds = new Set(
    expenseRows.map((e) => e.savings_goal_id).filter((id): id is string => Boolean(id)),
  );
  const savingsMonthly = savingsRows
    .filter((g) => !linkedSavingsIds.has(g.id))
    .reduce((s, g) => s + effectiveSavingsMonthly(g), 0);
  const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  const recurringSurplus = round2(
    recurringPlan.income -
      recurringPlan.expenses -
      recurringPlan.offerings -
      recurringPlan.savings -
      savingsMonthly -
      recurringPlan.debtMinimums,
  );
  const totalMin = round2(rows.reduce((s, d) => s + Number(d.min_payment), 0));
  const suggestedExtra = Math.max(0, recurringSurplus);
  const suggestedBudget = round2(totalMin + suggestedExtra);

  return (
    <PlansClient
      debts={debts}
      insightDebts={insightDebts}
      initialMethod={initialMethod}
      initialBudget={initialBudget}
      suggestedBudget={suggestedBudget}
      suggestedExtra={suggestedExtra}
      billingMonth={billingMonth}
    />
  );
}
