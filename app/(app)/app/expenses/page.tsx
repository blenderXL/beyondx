import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { featureState } from "@/lib/flags/server";
import { ComingSoon } from "@/components/finance/ComingSoon";
import { ExpensesClient, type DebtBill, type DebtOption, type ExpensesRail } from "@/components/finance/ExpensesClient";
import { buildMonthlyPlan, monthlyAmount, type PlannerDebt } from "@/lib/finance/planner";
import type { Debt, Expense, Income } from "@/lib/finance/types";

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

  // The billing month is the first day of the current (UTC) month — keys this month's check-offs.
  const now = new Date();
  const billingMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;

  const [expensesRes, debtsRes, incomesRes, paymentsRes] = await Promise.all([
    supabase.from("expenses").select("*").is("archived_at", null).order("created_at", { ascending: true }),
    // select("*") so a missing escrow/pmi column (pre-0014) reads as undefined rather than erroring.
    supabase.from("debts").select("*").is("archived_at", null).order("name", { ascending: true }),
    supabase.from("incomes").select("*").is("archived_at", null),
    supabase
      .from("transactions")
      .select("expense_id, debt_id")
      .eq("kind", "payment")
      .eq("billing_month", billingMonth),
  ]);

  const payments = (paymentsRes.data ?? []) as { expense_id: string | null; debt_id: string | null }[];
  const paidExpenseIds = payments.map((t) => t.expense_id).filter((id): id is string => Boolean(id));
  const paidDebtIds = payments.map((t) => t.debt_id).filter((id): id is string => Boolean(id));

  const expenses = (expensesRes.data ?? []) as Expense[];
  const debtRows = (debtsRes.data ?? []) as Debt[];
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

  // Recurring debt obligations auto-appear as bill rows — every active debt NOT already
  // represented by a linked expense, pre-filled with its minimum.
  const debtBills: DebtBill[] = debtRows
    .filter((d) => !linkedDebtIds.has(d.id) && Number(d.min_payment) > 0)
    .map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      balance: Number(d.balance),
      apr: Number(d.apr),
      min_payment: Number(d.min_payment),
      escrow: d.escrow == null ? null : Number(d.escrow),
      pmi: d.pmi == null ? null : Number(d.pmi),
      dueDay: d.next_due_date ? new Date(`${d.next_due_date}T00:00:00Z`).getUTCDate() : d.due_day,
    }));

  return (
    <ExpensesClient
      expenses={expenses}
      debts={debts}
      rail={rail}
      income={plan.income}
      billingMonth={billingMonth}
      paidExpenseIds={paidExpenseIds}
      debtBills={debtBills}
      paidDebtIds={paidDebtIds}
    />
  );
}
