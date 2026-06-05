import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { featureState } from "@/lib/flags/server";
import { ComingSoon } from "@/components/finance/ComingSoon";
import { ExpensesClient, type DebtOption, type ExpensesRail } from "@/components/finance/ExpensesClient";
import { buildMonthlyPlan, monthlyAmount, type PlannerDebt } from "@/lib/finance/planner";
import type { Expense, Income } from "@/lib/finance/types";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  // Gate A: hidden until the `expenses` release flag is flipped on.
  const { visible } = await featureState("expenses");
  if (!visible) return <ComingSoon title="Expenses" />;

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [expensesRes, debtsRes, incomesRes] = await Promise.all([
    supabase.from("expenses").select("*").is("archived_at", null).order("created_at", { ascending: true }),
    supabase
      .from("debts")
      .select("id, name, type, min_payment, due_day, next_due_date")
      .is("archived_at", null)
      .order("name", { ascending: true }),
    supabase.from("incomes").select("*").is("archived_at", null),
  ]);

  const expenses = (expensesRes.data ?? []) as Expense[];
  type DebtRow = {
    id: string;
    name: string;
    type: DebtOption["type"];
    min_payment: number;
    due_day: number | null;
    next_due_date: string | null;
  };
  const debtRows = (debtsRes.data ?? []) as DebtRow[];
  const incomes = (incomesRes.data ?? []) as Income[];

  // Rail "money going toward" reuses the planner's group rollup. A linked debt's payment is
  // represented by its expense, so drop it from the debt minimums (same as the Budget page).
  const linkedDebtIds = new Set(expenses.map((e) => e.debt_id).filter((id): id is string => Boolean(id)));
  const plan = buildMonthlyPlan({
    incomes,
    expenses,
    debts: debtRows
      .filter((d) => !linkedDebtIds.has(d.id))
      .map<PlannerDebt>((d) => ({
        id: d.id,
        name: d.name,
        min_payment: Number(d.min_payment),
        due_day: d.next_due_date ? new Date(`${d.next_due_date}T00:00:00Z`).getUTCDate() : d.due_day,
      })),
  });

  const subs = expenses.filter((e) => e.expense_group === "subscription");
  const rail: ExpensesRail = {
    byGroup: plan.byGroup,
    subscriptionCount: subs.length,
    subscriptionTotal: subs.reduce((s, e) => s + monthlyAmount(Number(e.amount), e.cadence), 0),
  };

  const debts: DebtOption[] = debtRows.map((d) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    min_payment: Number(d.min_payment),
  }));

  return <ExpensesClient expenses={expenses} debts={debts} rail={rail} income={plan.income} />;
}
