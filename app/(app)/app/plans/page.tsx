import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { featureState } from "@/lib/flags/server";
import { ComingSoon } from "@/components/finance/ComingSoon";
import { PlansClient } from "@/components/finance/PlansClient";
import { resolvePayoffMethod, type PayoffDebtInput } from "@/lib/finance/payoff";
import type { InsightDebt } from "@/lib/finance/insights";
import type { Debt } from "@/lib/finance/types";

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

  return (
    <PlansClient
      debts={debts}
      insightDebts={insightDebts}
      initialMethod={initialMethod}
      initialBudget={initialBudget}
    />
  );
}
