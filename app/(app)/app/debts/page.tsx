import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { DebtsClient, type RecentActivity } from "@/components/finance/DebtsClient";
import type { DebtTxn } from "@/components/finance/DebtDetail";
import { bestExtraPaymentInsight } from "@/lib/finance/optimization";
import { resolvePayoffMethod, type PayoffDebtInput } from "@/lib/finance/payoff";
import type { Debt, TransactionKind } from "@/lib/finance/types";

export const dynamic = "force-dynamic";

interface TxnRow {
  id: string;
  debt_id: string | null;
  kind: TransactionKind;
  amount: number | string;
  occurred_on: string;
  note: string | null;
  expense_id: string | null;
  savings_goal_id: string | null;
  debts: { name: string } | { name: string }[] | null;
}

export default async function DebtsPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: debts }, { data: txnRaw }, { data: profile }] = await Promise.all([
    supabase.from("debts").select("*").is("archived_at", null).order("created_at", { ascending: true }),
    // All debt transactions (newest first) — feeds both the recent-activity list and the
    // per-debt lists shown in the detail modal. expense_id/savings_goal_id gate deletion.
    supabase
      .from("transactions")
      .select("id, debt_id, kind, amount, occurred_on, note, expense_id, savings_goal_id, debts(name)")
      .not("debt_id", "is", null)
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
  ]);

  const rows = (txnRaw ?? []) as TxnRow[];

  const recent: RecentActivity[] = rows.slice(0, 15).map((r) => ({
    id: r.id,
    kind: r.kind,
    amount: Number(r.amount),
    occurredOn: r.occurred_on,
    note: r.note,
    debtName: Array.isArray(r.debts) ? (r.debts[0]?.name ?? null) : (r.debts?.name ?? null),
  }));

  const txnsByDebt: Record<string, DebtTxn[]> = {};
  for (const r of rows) {
    if (!r.debt_id) continue;
    (txnsByDebt[r.debt_id] ??= []).push({
      id: r.id,
      kind: r.kind,
      amount: Number(r.amount),
      occurredOn: r.occurred_on,
      note: r.note,
      fromExpense: r.expense_id != null || r.savings_goal_id != null,
    });
  }

  const debtRows = (debts ?? []) as Debt[];
  const method = resolvePayoffMethod((profile as { payoff_method?: unknown } | null)?.payoff_method);
  const payoffInput: PayoffDebtInput[] = debtRows.map((d) => ({
    id: d.id,
    name: d.name,
    balance: Number(d.balance),
    apr: Number(d.apr),
    min_payment: Number(d.min_payment),
  }));
  const insight = bestExtraPaymentInsight(payoffInput, method);

  return <DebtsClient debts={debtRows} recent={recent} txnsByDebt={txnsByDebt} insight={insight} />;
}
