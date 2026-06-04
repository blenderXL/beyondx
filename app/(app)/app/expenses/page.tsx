import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { featureState } from "@/lib/flags/server";
import { ComingSoon } from "@/components/finance/ComingSoon";
import { ExpensesClient } from "@/components/finance/ExpensesClient";
import type { Expense } from "@/lib/finance/types";

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

  const [expensesRes, debtsRes] = await Promise.all([
    supabase.from("expenses").select("*").is("archived_at", null).order("created_at", { ascending: true }),
    supabase.from("debts").select("id, name").is("archived_at", null).order("name", { ascending: true }),
  ]);

  const debts = (debtsRes.data ?? []) as { id: string; name: string }[];

  return <ExpensesClient expenses={(expensesRes.data ?? []) as Expense[]} debts={debts} />;
}
