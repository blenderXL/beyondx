import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { DebtsClient, type RecentActivity } from "@/components/finance/DebtsClient";
import type { Debt, TransactionKind } from "@/lib/finance/types";

export const dynamic = "force-dynamic";

interface RecentRow {
  id: string;
  kind: TransactionKind;
  amount: number | string;
  occurred_on: string;
  note: string | null;
  debts: { name: string } | { name: string }[] | null;
}

export default async function DebtsPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: debts } = await supabase
    .from("debts")
    .select("*")
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  // Pull the debt name alongside each transaction so archived debts still label correctly.
  const { data: recentRaw } = await supabase
    .from("transactions")
    .select("id, kind, amount, occurred_on, note, debts(name)")
    .order("created_at", { ascending: false })
    .limit(15);

  const recent: RecentActivity[] = ((recentRaw ?? []) as RecentRow[]).map((r) => ({
    id: r.id,
    kind: r.kind,
    amount: Number(r.amount),
    occurredOn: r.occurred_on,
    note: r.note,
    debtName: Array.isArray(r.debts) ? (r.debts[0]?.name ?? null) : (r.debts?.name ?? null),
  }));

  return <DebtsClient debts={(debts ?? []) as Debt[]} recent={recent} />;
}
