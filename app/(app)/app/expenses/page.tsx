import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { featureState } from "@/lib/flags/server";
import { ComingSoon } from "@/components/finance/ComingSoon";
import {
  ExpensesClient,
  type DebtBill,
  type DebtOption,
  type ExpensesRail,
  type SavingsBill,
} from "@/components/finance/ExpensesClient";
import { ExpensesHistory } from "@/components/finance/ExpensesHistory";
import { buildMonthlyPlan, monthlyAmount, type PlannerDebt } from "@/lib/finance/planner";
import { monthOptions, type HistoryItem } from "@/lib/finance/history";
import type { Debt, Expense, Income, SavingsGoal } from "@/lib/finance/types";

export const dynamic = "force-dynamic";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  // Gate A: hidden until the `expenses` release flag is flipped on.
  const { visible } = await featureState("expenses");
  if (!visible) return <ComingSoon title="Expenses" />;

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // The billing month is the first day of the current (UTC) month — keys this month's check-offs.
  const now = new Date();
  const billingMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;

  // Month switcher: the current month + the prior 11. A `?month=` from the past is a read-only
  // history view; anything else (incl. the current month) is the live, editable hub.
  const months = monthOptions(now.getUTCFullYear(), now.getUTCMonth(), 12);
  const { month: monthParam } = await searchParams;
  const selectedMonth = months.some((m) => m.value === monthParam) ? monthParam! : billingMonth;

  if (selectedMonth !== billingMonth) {
    const { data: txns } = await supabase
      .from("transactions")
      .select("id, amount, kind, expenses(category), debts(name), savings_goals(name)")
      .eq("billing_month", selectedMonth)
      .in("kind", ["payment", "contribution"])
      .order("occurred_on", { ascending: true });
    // PostgREST embeds a to-one relation as a single object (or null) at runtime; the generated
    // types say array, so cast through unknown.
    type HistRow = {
      id: string;
      amount: number;
      kind: "payment" | "contribution";
      expenses: { category: string } | null;
      debts: { name: string } | null;
      savings_goals: { name: string } | null;
    };
    const items: HistoryItem[] = ((txns ?? []) as unknown as HistRow[]).map((t) => ({
      id: t.id,
      name: t.expenses?.category ?? t.debts?.name ?? t.savings_goals?.name ?? "—",
      kind: t.kind,
      amount: Number(t.amount),
    }));
    const monthLabel = months.find((m) => m.value === selectedMonth)!.label;
    return (
      <ExpensesHistory
        monthLabel={monthLabel}
        months={months}
        selected={selectedMonth}
        currentMonth={billingMonth}
        items={items}
      />
    );
  }

  const [expensesRes, debtsRes, savingsRes, incomesRes, paymentsRes, contribRes, overridesRes] = await Promise.all([
    supabase.from("expenses").select("*").is("archived_at", null).order("created_at", { ascending: true }),
    // select("*") so a missing escrow/pmi column (pre-0014) reads as undefined rather than erroring.
    supabase.from("debts").select("*").is("archived_at", null).order("name", { ascending: true }),
    // select("*") so a missing monthly_contribution column (pre-0015) degrades gracefully.
    supabase.from("savings_goals").select("*").is("archived_at", null).order("name", { ascending: true }),
    supabase.from("incomes").select("*").is("archived_at", null),
    supabase.from("transactions").select("expense_id, debt_id").eq("kind", "payment").eq("billing_month", billingMonth),
    supabase.from("transactions").select("savings_goal_id").eq("kind", "contribution").eq("billing_month", billingMonth),
    // Variable-income actuals for this month (migration 0010); degrades to none if absent.
    supabase.from("income_overrides").select("income_id, amount").eq("billing_month", billingMonth),
  ]);

  const payments = (paymentsRes.data ?? []) as { expense_id: string | null; debt_id: string | null }[];
  const paidExpenseIds = payments.map((t) => t.expense_id).filter((id): id is string => Boolean(id));
  const paidDebtIds = payments.map((t) => t.debt_id).filter((id): id is string => Boolean(id));
  const paidSavingsIds = ((contribRes.data ?? []) as { savings_goal_id: string | null }[])
    .map((t) => t.savings_goal_id)
    .filter((id): id is string => Boolean(id));

  const expenses = (expensesRes.data ?? []) as Expense[];
  const debtRows = (debtsRes.data ?? []) as Debt[];
  const savingsRows = (savingsRes.data ?? []) as SavingsGoal[];
  const incomes = (incomesRes.data ?? []) as Income[];

  // income_id → this month's actual amount (variable sources).
  const overrides: Record<string, number> = {};
  for (const o of (overridesRes.data ?? []) as { income_id: string; amount: number }[]) {
    overrides[o.income_id] = Number(o.amount);
  }

  // Rail "money going toward" reuses the planner's group rollup. A linked debt's payment is
  // represented by its expense, so drop it from the debt minimums (same as the Budget page).
  const linkedDebtIds = new Set(expenses.map((e) => e.debt_id).filter((id): id is string => Boolean(id)));
  const plan = buildMonthlyPlan({
    incomes,
    expenses,
    overrides,
    debts: debtRows
      .filter((d) => !linkedDebtIds.has(d.id))
      .map<PlannerDebt>((d) => ({
        id: d.id,
        name: d.name,
        min_payment: Number(d.min_payment),
        due_day: d.next_due_date ? new Date(`${d.next_due_date}T00:00:00Z`).getUTCDate() : d.due_day,
      })),
  });

  const subs = expenses.filter((e) => e.expense_group === "subscription");
  const rail: ExpensesRail = {
    byGroup: plan.byGroup,
    subscriptionCount: subs.length,
    subscriptionTotal: subs.reduce((s, e) => s + monthlyAmount(Number(e.amount), e.cadence), 0),
  };

  const debts: DebtOption[] = debtRows.map((d) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    min_payment: Number(d.min_payment),
  }));

  // Savings goals the expense form can link a "pay toward savings" expense to.
  const savingsOptions = savingsRows.map((g) => ({ id: g.id, name: g.name }));

  // Recurring debt obligations auto-appear as bill rows — every active debt NOT already
  // represented by a linked expense, pre-filled with its minimum.
  const debtBills: DebtBill[] = debtRows
    .filter((d) => !linkedDebtIds.has(d.id) && Number(d.min_payment) > 0)
    .map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      balance: Number(d.balance),
      apr: Number(d.apr),
      min_payment: Number(d.min_payment),
      escrow: d.escrow == null ? null : Number(d.escrow),
      pmi: d.pmi == null ? null : Number(d.pmi),
      dueDay: d.next_due_date ? new Date(`${d.next_due_date}T00:00:00Z`).getUTCDate() : d.due_day,
    }));

  // Recurring savings (a positive monthly contribution) auto-appear as checkable bill rows.
  const savingsBills: SavingsBill[] = savingsRows
    .filter((g) => g.monthly_contribution != null && Number(g.monthly_contribution) > 0)
    .map((g) => ({
      id: g.id,
      name: g.name,
      monthly_contribution: Number(g.monthly_contribution),
    }));

  // Per-source monthly income (override-resolved, same math as buildMonthlyPlan) — powers the
  // offering card's "10% × each source" breakdown so it sums to the offering total.
  const incomeBreakdown = incomes
    .map((i) => {
      const ov = overrides[i.id];
      const base = i.is_variable && ov != null ? ov : Number(i.amount);
      const monthly = i.cadence === "one_time" ? base : monthlyAmount(base, i.cadence);
      return { source: i.source, monthly };
    })
    .filter((b) => b.monthly > 0);

  return (
    <ExpensesClient
      expenses={expenses}
      debts={debts}
      rail={rail}
      income={plan.income}
      billingMonth={billingMonth}
      paidExpenseIds={paidExpenseIds}
      debtBills={debtBills}
      paidDebtIds={paidDebtIds}
      savingsBills={savingsBills}
      paidSavingsIds={paidSavingsIds}
      plan={plan}
      incomes={incomes}
      incomeBreakdown={incomeBreakdown}
      savingsOptions={savingsOptions}
      months={months}
      currentMonth={billingMonth}
    />
  );
}
