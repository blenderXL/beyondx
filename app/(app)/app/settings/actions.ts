"use server";

import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { captureError } from "@/lib/telemetry/capture";
import {
  serializePortfolio,
  parsePortfolio,
  pickColumns,
  remapId,
  PORTFOLIO_COLUMNS,
  type PortfolioData,
  type Row,
} from "@/lib/finance/portfolio";

/**
 * Account/data actions for Settings: export a JSON backup, restore one into the current
 * account (fresh ids, remapped FKs, ownership forced to the signed-in user), and delete the
 * account. All reads/writes are RLS-scoped to the caller; deletion uses the service role to
 * remove the auth user (which cascades to every owned row).
 */

async function requireUser() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Hard cap so a malicious/huge file can't be used to hammer the DB. */
const MAX_ROWS = 20_000;

export async function exportPortfolio(): Promise<{ json?: string; error?: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "You're signed out. Log in and try again." };

  const [debts, incomes, expenses, savings, txns] = await Promise.all([
    supabase.from("debts").select("*"),
    supabase.from("incomes").select("*"),
    supabase.from("expenses").select("*"),
    supabase.from("savings_goals").select("*"),
    supabase.from("transactions").select("*"),
  ]);
  const firstError = [debts, incomes, expenses, savings, txns].find((r) => r.error)?.error;
  if (firstError) {
    captureError(firstError, { action: "exportPortfolio" });
    return { error: "Couldn't export your data. Please try again." };
  }

  const data: PortfolioData = {
    debts: (debts.data ?? []) as Row[],
    incomes: (incomes.data ?? []) as Row[],
    expenses: (expenses.data ?? []) as Row[],
    savings_goals: (savings.data ?? []) as Row[],
    transactions: (txns.data ?? []) as Row[],
  };
  return { json: serializePortfolio(data, new Date().toISOString()) };
}

interface ImportResult {
  ok?: boolean;
  error?: string;
  counts?: Record<string, number>;
}

export async function importPortfolio(raw: string): Promise<ImportResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "You're signed out. Log in and try again." };

  const parsed = parsePortfolio(raw);
  if (!parsed.ok) return { error: parsed.error };
  const { data } = parsed.doc;

  const total =
    data.debts.length + data.incomes.length + data.expenses.length +
    data.savings_goals.length + data.transactions.length;
  if (total > MAX_ROWS) return { error: "That backup is too large to import." };

  const profile_id = user.id;
  const fail = (e: unknown, where: string): ImportResult => {
    captureError(e, { action: `importPortfolio.${where}` });
    return { error: "Couldn't import the backup. It may be corrupt or from an incompatible version." };
  };

  // Helper: insert allow-listed rows (+ any extra per-row fields) and return new ids in order.
  async function insertRows(
    table: keyof typeof PORTFOLIO_COLUMNS,
    rows: Row[],
    extra: (r: Row) => Row = () => ({}),
  ): Promise<{ ids: string[]; error?: unknown }> {
    if (rows.length === 0) return { ids: [] };
    const payload = rows.map((r) => ({ profile_id, ...pickColumns(r, table), ...extra(r) }));
    const { data: inserted, error } = await supabase.from(table).insert(payload).select("id");
    if (error) return { ids: [], error };
    return { ids: (inserted ?? []).map((x) => (x as { id: string }).id) };
  }

  // 1. FK-free parents first.
  const debtsRes = await insertRows("debts", data.debts);
  if (debtsRes.error) return fail(debtsRes.error, "debts");
  const debtMap = new Map(data.debts.map((r, i) => [String((r as Row).id ?? ""), debtsRes.ids[i]!]));

  const savingsRes = await insertRows("savings_goals", data.savings_goals);
  if (savingsRes.error) return fail(savingsRes.error, "savings_goals");
  const savingsMap = new Map(
    data.savings_goals.map((r, i) => [String((r as Row).id ?? ""), savingsRes.ids[i]!]),
  );

  const incomesRes = await insertRows("incomes", data.incomes);
  if (incomesRes.error) return fail(incomesRes.error, "incomes");

  // 2. Expenses reference a debt.
  const expensesRes = await insertRows("expenses", data.expenses, (r) => ({
    debt_id: remapId(debtMap, (r as Row).debt_id),
  }));
  if (expensesRes.error) return fail(expensesRes.error, "expenses");
  const expenseMap = new Map(
    data.expenses.map((r, i) => [String((r as Row).id ?? ""), expensesRes.ids[i]!]),
  );

  // 3. Transactions reference debt / expense / savings.
  const txnsRes = await insertRows("transactions", data.transactions, (r) => ({
    debt_id: remapId(debtMap, (r as Row).debt_id),
    expense_id: remapId(expenseMap, (r as Row).expense_id),
    savings_goal_id: remapId(savingsMap, (r as Row).savings_goal_id),
  }));
  if (txnsRes.error) return fail(txnsRes.error, "transactions");

  return {
    ok: true,
    counts: {
      debts: data.debts.length,
      incomes: data.incomes.length,
      expenses: data.expenses.length,
      savings_goals: data.savings_goals.length,
      transactions: data.transactions.length,
    },
  };
}

/**
 * Every user-entered data table, in child→parent order so deletes never trip a foreign key
 * (most FKs cascade/set-null, but ordering keeps it safe regardless). The account itself —
 * `profiles`, auth, security/MFA, tier, and the `legal_acceptances` audit trail — is preserved.
 */
const RESET_TABLES = [
  "transactions",
  "income_overrides",
  "plan_runs",
  "expenses",
  "plans",
  "cards",
  "debts",
  "savings_goals",
  "incomes",
  "accounts",
  "paystub_inputs",
] as const;

// The exact phrase the user must type to reset — case-insensitive on input. NOT exported:
// a "use server" module may export only async functions (the client uses its own literal).
const RESET_CONFIRM_PHRASE = "RESET";

/**
 * Wipe everything the user has entered (debts, incomes, expenses, savings pots, cards,
 * transactions, plans, paystub inputs, budget) while keeping their account, login, tier, and
 * legal consent. Deletes are RLS-scoped to the caller (and filtered by `profile_id`). Not a
 * single transaction — a mid-way failure returns an error and is safe to retry (deletes are
 * idempotent), matching the app's accepted non-atomicity for single-user manual actions.
 */
export async function resetAccount(confirm: string): Promise<{ ok?: boolean; error?: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "You're signed out. Log in and try again." };

  if (confirm.trim().toUpperCase() !== RESET_CONFIRM_PHRASE) {
    return { error: `Type ${RESET_CONFIRM_PHRASE} to confirm.` };
  }

  for (const table of RESET_TABLES) {
    const { error } = await supabase.from(table).delete().eq("profile_id", user.id);
    if (error) {
      captureError(error, { action: `resetAccount.${table}` });
      return { error: "Couldn't reset everything. Some data may remain — try again." };
    }
  }

  // Clear the user-entered payoff budget (a column on `profiles`); the row itself stays.
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ payoff_budget: null })
    .eq("id", user.id);
  if (profileError) {
    captureError(profileError, { action: "resetAccount.profile" });
    return { error: "Couldn't reset everything. Some data may remain — try again." };
  }

  // Every signed-in surface reads this data — refresh them all.
  revalidatePath("/app", "layout");
  return { ok: true };
}

/**
 * Permanently delete the account. Requires the user to retype their email (defense against
 * accidental/click-jacked deletion). Uses the service role to remove the auth user, which
 * cascades to `profiles` and every finance table via `on delete cascade`.
 */
export async function deleteAccount(confirmEmail: string): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  if (!user || !user.email) return { error: "You're signed out. Log in and try again." };

  if (confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
    return { error: "The email you typed doesn't match this account." };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return { error: "Account deletion isn't available right now." };
  }

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    captureError(error, { action: "deleteAccount" });
    return { error: "Couldn't delete the account. Please try again." };
  }

  await supabase.auth.signOut();
  redirect("/");
}
