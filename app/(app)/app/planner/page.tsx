import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { featureState } from "@/lib/flags/server";
import { ComingSoon } from "@/components/finance/ComingSoon";
import { PlannerView } from "@/components/finance/PlannerView";
import type { PlannerBill } from "@/components/finance/PlannerBills";
import { buildMonthlyPlan, type PlannerDebt } from "@/lib/finance/planner";
import { EXPENSE_GROUP_LABELS, type Income, type Expense } from "@/lib/finance/types";

export const dynamic = "force-dynamic";

/** Day-of-month from the real Next Due Date, falling back to the legacy due_day. */
function dueDayOf(nextDueDate: string | null, dueDay: number | null): number | null {
  return nextDueDate ? new Date(nextDueDate).getUTCDate() : dueDay;
}

export default async function PlannerPage() {
  // Gate A: hidden until the `planner` release flag is flipped on.
  const { visible } = await featureState("planner");
  if (!visible) return <ComingSoon title="Planner" />;

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // The billing month is the first day of the current (UTC) month.
  const now = new Date();
  const billingMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;

  const [incomesRes, expensesRes, debtsRes, paymentsRes] = await Promise.all([
    supabase.from("incomes").select("*").is("archived_at", null),
    supabase.from("expenses").select("*").is("archived_at", null),
    supabase.from("debts").select("id, name, min_payment, due_day, next_due_date").is("archived_at", null),
    supabase.from("transactions").select("expense_id, debt_id").eq("kind", "payment").eq("billing_month", billingMonth),
  ]);

  const expenses = (expensesRes.data ?? []) as Expense[];
  type DebtRow = { id: string; name: string; min_payment: number; due_day: number | null; next_due_date: string | null };
  const debts = (debtsRes.data ?? []) as DebtRow[];

  const plan = buildMonthlyPlan({
    incomes: (incomesRes.data ?? []) as Income[],
    expenses,
    debts: debts.map<PlannerDebt>((d) => ({
      id: d.id,
      name: d.name,
      min_payment: Number(d.min_payment),
      due_day: dueDayOf(d.next_due_date, d.due_day),
    })),
  });

  // Paid state: which items already have a payment in this billing month.
  const paidExpense = new Set<string>();
  const paidDebt = new Set<string>();
  for (const t of (paymentsRes.data ?? []) as { expense_id: string | null; debt_id: string | null }[]) {
    if (t.expense_id) paidExpense.add(t.expense_id);
    if (t.debt_id) paidDebt.add(t.debt_id);
  }

  // Each expense + each debt (with a positive minimum) is a checkable bill for the month.
  const bills: PlannerBill[] = [
    ...expenses.map<PlannerBill>((e) => ({
      kind: "expense",
      id: e.id,
      name: e.category,
      sublabel: e.expense_group ? EXPENSE_GROUP_LABELS[e.expense_group] : "Expense",
      amount: Number(e.amount),
      dueDay: e.due_day,
      paid: paidExpense.has(e.id),
    })),
    ...debts.map<PlannerBill>((d) => ({
      kind: "debt",
      id: d.id,
      name: d.name,
      sublabel: "Min. payment",
      amount: Number(d.min_payment),
      dueDay: dueDayOf(d.next_due_date, d.due_day),
      paid: paidDebt.has(d.id),
    })),
  ].filter((b) => b.amount > 0);

  return <PlannerView plan={plan} bills={bills} billingMonth={billingMonth} />;
}
