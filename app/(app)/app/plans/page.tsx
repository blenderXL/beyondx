import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { featureState } from "@/lib/flags/server";
import { ComingSoon } from "@/components/finance/ComingSoon";
import { PlansClient } from "@/components/finance/PlansClient";
import { resolvePayoffMethod, type PayoffDebtInput } from "@/lib/finance/payoff";
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

  // Pre-migration-safe: `payoff_method` only exists on nzx-dev/prod after 0013 lands
  // (deploy-dev on merge). Reading it before then errors → fall back to the default.
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("payoff_method")
    .eq("id", user.id)
    .maybeSingle();
  const initialMethod = resolvePayoffMethod(
    profileErr ? null : (profile as { payoff_method?: unknown } | null)?.payoff_method,
  );

  const { data } = await supabase
    .from("debts")
    .select("id, name, type, balance, apr, min_payment, payoff_order")
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  const debts: PayoffDebtInput[] = ((data ?? []) as Pick<Debt, "id" | "name" | "type" | "balance" | "apr" | "min_payment" | "payoff_order">[]).map((d) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    balance: Number(d.balance),
    apr: Number(d.apr),
    min_payment: Number(d.min_payment),
    payoff_order: d.payoff_order,
  }));

  return <PlansClient debts={debts} initialMethod={initialMethod} />;
}
