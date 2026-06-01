import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { featureState } from "@/lib/flags/server";
import { ComingSoon } from "@/components/finance/ComingSoon";
import { SavingsClient } from "@/components/finance/SavingsClient";
import type { SavingsGoal } from "@/lib/finance/types";

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

  const { data } = await supabase
    .from("savings_goals")
    .select("*")
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  return <SavingsClient goals={(data ?? []) as SavingsGoal[]} />;
}
