import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { featureState } from "@/lib/flags/server";
import { ComingSoon } from "@/components/finance/ComingSoon";
import { PlansClient } from "@/components/finance/PlansClient";
import type { PayoffDebtInput } from "@/lib/finance/payoff";
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

  return <PlansClient debts={debts} />;
}
