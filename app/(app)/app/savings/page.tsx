import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { featureState } from "@/lib/flags/server";
import { ComingSoon } from "@/components/finance/ComingSoon";
import { SavingsClient } from "@/components/finance/SavingsClient";
import type { SavingsGoal } from "@/lib/finance/types";
import { cumulativeByMonth, recentMonths, type MonthlyContribution } from "@/lib/finance/savings";

export const dynamic = "force-dynamic";

export default async function SavingsPage() {
  // Gate A: hidden until the `savings` release flag is flipped on.
  const { visible } = await featureState("savings");
  if (!visible) return <ComingSoon title="Savings" />;

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const now = new Date();
  const months = recentMonths(now.getUTCFullYear(), now.getUTCMonth(), 6);

  const [goalsRes, contribRes] = await Promise.all([
    supabase.from("savings_goals").select("*").is("archived_at", null).order("created_at", { ascending: true }),
    supabase.from("transactions").select("amount, occurred_on").eq("kind", "contribution"),
  ]);

  // Cumulative saved total per month (trajectory) from contribution transactions.
  const contributions: MonthlyContribution[] = ((contribRes.data ?? []) as { amount: number; occurred_on: string }[]).map(
    (t) => ({ amount: Number(t.amount), month: String(t.occurred_on).slice(0, 7) }),
  );
  const trajectory = cumulativeByMonth(contributions, months);

  return <SavingsClient goals={(goalsRes.data ?? []) as SavingsGoal[]} trajectory={trajectory} months={months} />;
}
