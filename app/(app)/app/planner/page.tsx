import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { featureState } from "@/lib/flags/server";
import { ComingSoon } from "@/components/finance/ComingSoon";
import { PlannerView } from "@/components/finance/PlannerView";
import { buildMonthlyPlan, type PlannerDebt } from "@/lib/finance/planner";
import type { Income, Expense } from "@/lib/finance/types";

export const dynamic = "force-dynamic";

export default async function PlannerPage() {
  // Gate A: hidden until the `planner` release flag is flipped on.
  const { visible } = await featureState("planner");
  if (!visible) return <ComingSoon title="Planner" />;

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [incomesRes, expensesRes, debtsRes] = await Promise.all([
    supabase.from("incomes").select("*").is("archived_at", null),
    supabase.from("expenses").select("*").is("archived_at", null),
    supabase.from("debts").select("id, name, min_payment, due_day").is("archived_at", null),
  ]);

  const plan = buildMonthlyPlan({
    incomes: (incomesRes.data ?? []) as Income[],
    expenses: (expensesRes.data ?? []) as Expense[],
    debts: ((debtsRes.data ?? []) as PlannerDebt[]).map((d) => ({
      id: d.id,
      name: d.name,
      min_payment: Number(d.min_payment),
      due_day: d.due_day,
    })),
  });

  return <PlannerView plan={plan} />;
}
