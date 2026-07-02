"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  validateCardInput,
  validateDebtInput,
  validateExpenseInput,
  validateIncomeInput,
  validateIncomeOverrideInput,
  validateSavingsGoalInput,
  validateContributionInput,
  validateTransactionInput,
  parseMoney,
  round2,
} from "@/lib/finance/validation";
import { applyTransactionToBalance } from "@/lib/finance/balance";
import { splitPayment } from "@/lib/finance/payment";
import { isPayoffMethod, type PayoffMethod } from "@/lib/finance/payoff";
import { buildMonthlyPlan } from "@/lib/finance/planner";
import type { Income } from "@/lib/finance/types";
import { captureError } from "@/lib/telemetry/capture";
import type { PaystubInputs } from "@/lib/paystub/tax";
import type { FinanceActionState } from "@/lib/finance/actionState";

/**
 * Finance Server Actions (Phase 1: debts + transactions). Mirrors the auth actions:
 * validate on the server (client constraints are UX-only), keep messages human, and
 * let RLS scope every write to the signed-in profile. `profile_id` is also set
 * explicitly on insert so a row can never be created against someone else.
 *
 * The debt `balance` is the source of truth; `addTransaction` adjusts it in a single
 * read-modify-write. That isn't atomic under true concurrency — acceptable for
 * single-user manual entry (see the plan's open items); flooring at zero is enforced
 * in `applyTransactionToBalance`.
 */

const DEBTS_PATH = "/app/debts";

async function requireUserId() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}

/**
 * Report an unexpected Supabase error to Sentry (these actions return a Result rather than
 * throwing, so Sentry wouldn't see them otherwise) and return the user-facing message. The
 * `action` tag is the only context — no row data, so nothing financial leaks.
 */
function dbFailure(error: unknown, action: string, message: string): FinanceActionState {
  captureError(error, { action });
  return { error: message };
}

/**
 * `start_date` only matters once migration 0011 lands; omitting it when blank keeps debt
 * writes working before then. `original_balance` is omitted when blank so editing a debt
 * (without touching the optional starting-balance field) never wipes its baseline — create
 * supplies the default explicitly. `escrow`/`pmi` (migration 0014) are likewise omitted when
 * blank so writes stay safe before the columns exist and a blank field never clears them.
 */
function debtPayload(values: import("@/lib/finance/validation").DebtValues): Record<string, unknown> {
  const payload = { ...values } as Record<string, unknown>;
  if (values.original_balance === null) delete payload.original_balance;
  if (values.start_date === null) delete payload.start_date;
  if (values.escrow === null) delete payload.escrow;
  if (values.pmi === null) delete payload.pmi;
  return payload;
}

export async function createDebt(
  _prev: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  const { supabase, userId } = await requireUserId();
  if (!userId) return { error: "You're signed out. Log in and try again." };

  const result = validateDebtInput(Object.fromEntries(formData));
  if (!result.ok || !result.values) return { error: result.error };

  // Baseline for "% paid off": use the user's starting balance if they set one, else the
  // current balance. It stays fixed as they pay the debt down.
  const payload = debtPayload(result.values);
  payload.original_balance = result.values.original_balance ?? result.values.balance;
  const { error } = await supabase.from("debts").insert({ profile_id: userId, ...payload });
  if (error) return dbFailure(error, "createDebt", "Couldn't save the debt. Please try again.");

  // Debts surface as bill cards (and a detail modal) on the Expenses page too.
  revalidatePath(DEBTS_PATH);
  revalidatePath(EXPENSES_PATH);
  return { error: null, ok: true };
}

export async function updateDebt(
  _prev: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  const { supabase, userId } = await requireUserId();
  if (!userId) return { error: "You're signed out. Log in and try again." };

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Missing debt id." };

  const result = validateDebtInput(Object.fromEntries(formData), "update");
  if (!result.ok || !result.values) return { error: result.error };

  // `.select()` lets us tell "updated nothing" (wrong id / not yours via RLS) from a real error.
  const { data, error } = await supabase
    .from("debts")
    .update(debtPayload(result.values))
    .eq("id", id)
    .select("id");
  if (error) return dbFailure(error, "updateDebt", "Couldn't update the debt. Please try again.");
  if (!data || data.length === 0) return { error: "Debt not found." };

  revalidatePath(DEBTS_PATH);
  revalidatePath(EXPENSES_PATH);
  return { error: null, ok: true };
}

export async function archiveDebt(
  _prev: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  const { supabase, userId } = await requireUserId();
  if (!userId) return { error: "You're signed out. Log in and try again." };

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Missing debt id." };

  const { data, error } = await supabase
    .from("debts")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .is("archived_at", null)
    .select("id");
  if (error) return dbFailure(error, "archiveDebt", "Couldn't archive the debt. Please try again.");
  if (!data || data.length === 0) return { error: "Debt not found." };

  revalidatePath(DEBTS_PATH);
  revalidatePath(EXPENSES_PATH);
  return { error: null, ok: true };
}

export async function addTransaction(
  _prev: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  const { supabase, userId } = await requireUserId();
  if (!userId) return { error: "You're signed out. Log in and try again." };

  const debtId = String(formData.get("debt_id") ?? "").trim();
  if (!debtId) return { error: "Missing debt." };

  const result = validateTransactionInput(Object.fromEntries(formData));
  if (!result.ok || !result.values) return { error: result.error };
  const { kind, amount, occurred_on, note } = result.values;

  // Read the current balance (RLS returns only the owner's row).
  const { data: debt, error: readError } = await supabase
    .from("debts")
    .select("balance")
    .eq("id", debtId)
    .maybeSingle();
  if (readError) return dbFailure(readError, "addTransaction.read", "Couldn't load the debt. Please try again.");
  if (!debt) return { error: "Debt not found." };

  const newBalance = applyTransactionToBalance(Number(debt.balance), kind, amount);

  const { error: insertError } = await supabase.from("transactions").insert({
    profile_id: userId,
    debt_id: debtId,
    kind,
    amount,
    note,
    ...(occurred_on ? { occurred_on } : {}),
  });
  if (insertError)
    return dbFailure(insertError, "addTransaction.insert", "Couldn't record the transaction. Please try again.");

  const { error: balanceError } = await supabase
    .from("debts")
    .update({ balance: newBalance })
    .eq("id", debtId);
  if (balanceError) {
    return dbFailure(
      balanceError,
      "addTransaction.balance",
      "Recorded the transaction, but the balance didn't update. Refresh and check.",
    );
  }

  revalidatePath(DEBTS_PATH);
  revalidatePath(EXPENSES_PATH);
  return { error: null, ok: true };
}

/**
 * Delete a MANUAL debt transaction and reverse its balance effect (a deleted payment adds the
 * amount back; a deleted charge subtracts it). Transactions that came from an expense check-off
 * (they carry expense_id / savings_goal_id) are owned by the Expenses page and are refused here —
 * the user reverts those from the Expenses page for that month.
 */
export async function deleteTransaction(
  _prev: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  const { supabase, userId } = await requireUserId();
  if (!userId) return { error: "You're signed out. Log in and try again." };

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Missing transaction id." };

  const { data: txn, error: readErr } = await supabase
    .from("transactions")
    .select("id, debt_id, expense_id, savings_goal_id, kind, amount")
    .eq("id", id)
    .maybeSingle();
  if (readErr) return dbFailure(readErr, "deleteTransaction.read", "Couldn't load the transaction. Please try again.");
  if (!txn) return { error: "Transaction not found." };
  if (txn.expense_id || txn.savings_goal_id) {
    return { error: "This payment came from an expense — revert it on the Expenses page for that month." };
  }

  // Reverse the balance effect before deleting (manual txns move the full amount, no split).
  if (txn.debt_id) {
    const { data: debt } = await supabase.from("debts").select("balance").eq("id", txn.debt_id).maybeSingle();
    if (debt) {
      const cur = Number(debt.balance);
      const amt = Number(txn.amount);
      const restored =
        txn.kind === "payment" ? round2(cur + amt) : txn.kind === "charge" ? Math.max(0, round2(cur - amt)) : cur;
      const { error: balErr } = await supabase.from("debts").update({ balance: restored }).eq("id", txn.debt_id);
      if (balErr) return dbFailure(balErr, "deleteTransaction.balance", "Couldn't update the balance. Please try again.");
    }
  }

  const { error: delErr } = await supabase.from("transactions").delete().eq("id", id);
  if (delErr) return dbFailure(delErr, "deleteTransaction.delete", "Couldn't delete the transaction. Please try again.");

  revalidatePath(DEBTS_PATH);
  revalidatePath(EXPENSES_PATH);
  return { error: null, ok: true };
}

const PLANS_PATH = "/app/plans";

/**
 * Persist the user's chosen payoff strategy on their profile so the Debt payoff planner reads
 * the same method. Called directly (not a form) from the method select; an invalid value
 * is ignored. A failed write is captured but not surfaced — it's a preference, not data.
 */
export async function setPayoffMethod(method: PayoffMethod): Promise<void> {
  if (!isPayoffMethod(method)) return;
  const { supabase, userId } = await requireUserId();
  if (!userId) return;
  const { error } = await supabase.from("profiles").update({ payoff_method: method }).eq("id", userId);
  if (error) {
    captureError(error, { action: "setPayoffMethod" });
    return;
  }
  revalidatePath(PLANS_PATH);
}

/**
 * Persist the user's monthly payoff budget on their profile so the Debt payoff planner and the
 * Dashboard project the same payoff date (no per-browser localStorage drift). Pre-migration
 * (before 0016) the write errors and is swallowed — the app falls back to its default budget.
 */
export async function setPayoffBudget(budget: number): Promise<void> {
  if (!Number.isFinite(budget) || budget < 0) return;
  const { supabase, userId } = await requireUserId();
  if (!userId) return;
  const { error } = await supabase
    .from("profiles")
    .update({ payoff_budget: round2(budget) })
    .eq("id", userId);
  if (error) {
    captureError(error, { action: "setPayoffBudget" });
    return;
  }
  revalidatePath(PLANS_PATH);
  revalidatePath("/app");
}

/** Persist the paycheck-calculator inputs (one row per user) so the form is pre-filled next
 * visit. Fire-and-forget from the client; the estimate itself is computed client-side. */
export async function savePaystubInputs(inputs: PaystubInputs): Promise<void> {
  const { supabase, userId } = await requireUserId();
  if (!userId) return;
  const { error } = await supabase
    .from("paystub_inputs")
    .upsert({ profile_id: userId, inputs }, { onConflict: "profile_id" });
  if (error) captureError(error, { action: "savePaystubInputs" });
}

/* ---- Phase 2: income / expenses / savings ----
 * Same shape as the debt actions: server-side validation, explicit `profile_id` on
 * insert, RLS scoping every write, and `.select("id")` to distinguish "not yours /
 * wrong id" from a real DB error. Soft-delete via `archived_at`. The three owner-scoped
 * helpers remove the create/update/archive boilerplate; the validators guarantee the
 * value shape, so the row payload is passed through opaquely. */

// Income management lives on the Expenses hub now (Phase 5C); revalidate there.
const INCOME_PATH = "/app/expenses";
const EXPENSES_PATH = "/app/expenses";
const SAVINGS_PATH = "/app/savings";

const SIGNED_OUT: FinanceActionState = { error: "You're signed out. Log in and try again." };

async function insertOwned(
  table: string,
  path: string,
  values: Record<string, unknown>,
): Promise<FinanceActionState> {
  const { supabase, userId } = await requireUserId();
  if (!userId) return SIGNED_OUT;
  const { error } = await supabase.from(table).insert({ profile_id: userId, ...values });
  if (error) return dbFailure(error, `insert:${table}`, "Couldn't save. Please try again.");
  revalidatePath(path);
  return { error: null, ok: true };
}

async function updateOwned(
  table: string,
  path: string,
  id: string,
  values: Record<string, unknown>,
): Promise<FinanceActionState> {
  const { supabase, userId } = await requireUserId();
  if (!userId) return SIGNED_OUT;
  if (!id) return { error: "Missing id." };
  const { data, error } = await supabase.from(table).update(values).eq("id", id).select("id");
  if (error) return dbFailure(error, `update:${table}`, "Couldn't update. Please try again.");
  if (!data || data.length === 0) return { error: "Not found." };
  revalidatePath(path);
  return { error: null, ok: true };
}

async function archiveOwned(table: string, path: string, id: string): Promise<FinanceActionState> {
  const { supabase, userId } = await requireUserId();
  if (!userId) return SIGNED_OUT;
  if (!id) return { error: "Missing id." };
  const { data, error } = await supabase
    .from(table)
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .is("archived_at", null)
    .select("id");
  if (error) return dbFailure(error, `archive:${table}`, "Couldn't archive. Please try again.");
  if (!data || data.length === 0) return { error: "Not found." };
  revalidatePath(path);
  return { error: null, ok: true };
}

function idOf(formData: FormData): string {
  return String(formData.get("id") ?? "").trim();
}

// Income
/**
 * `is_variable` only matters for the new variable-income feature (migration 0010). Omitting it
 * for ordinary (non-variable) sources keeps inserts/updates working even before that migration
 * reaches the DB — only the variable path depends on the column. Caveat (expand phase only):
 * un-marking a variable source therefore doesn't persist the `false` until the migration lands;
 * acceptable for the brief pre-deploy window (column default is already `false`).
 */
function incomePayload(values: import("@/lib/finance/validation").IncomeValues): Record<string, unknown> {
  const payload = { ...values } as Record<string, unknown>;
  if (!values.is_variable) delete payload.is_variable;
  return payload;
}

export async function createIncome(_p: FinanceActionState, formData: FormData): Promise<FinanceActionState> {
  const r = validateIncomeInput(Object.fromEntries(formData));
  if (!r.ok || !r.values) return { error: r.error };
  return insertOwned("incomes", INCOME_PATH, incomePayload(r.values));
}
export async function updateIncome(_p: FinanceActionState, formData: FormData): Promise<FinanceActionState> {
  const r = validateIncomeInput(Object.fromEntries(formData));
  if (!r.ok || !r.values) return { error: r.error };
  return updateOwned("incomes", INCOME_PATH, idOf(formData), incomePayload(r.values));
}
export async function archiveIncome(_p: FinanceActionState, formData: FormData): Promise<FinanceActionState> {
  return archiveOwned("incomes", INCOME_PATH, idOf(formData));
}

/**
 * Set (or replace) the actual amount for a variable income source this billing month
 * (migration 0010). Upserts on (income_id, billing_month). Ownership of the income is
 * verified up front (RLS scopes the lookup), and `profile_id` is set explicitly so the
 * row can never be created against someone else.
 */
export async function setIncomeOverride(_p: FinanceActionState, formData: FormData): Promise<FinanceActionState> {
  const { supabase, userId } = await requireUserId();
  if (!userId) return SIGNED_OUT;

  const r = validateIncomeOverrideInput(Object.fromEntries(formData));
  if (!r.ok || !r.values) return { error: r.error };

  const { data: inc, error: incErr } = await supabase
    .from("incomes")
    .select("id")
    .eq("id", r.values.income_id)
    .is("archived_at", null)
    .maybeSingle();
  if (incErr) return dbFailure(incErr, "setIncomeOverride.read", "Couldn't verify the income source. Please try again.");
  if (!inc) return { error: "That income source isn't available." };

  const { error } = await supabase
    .from("income_overrides")
    .upsert({ profile_id: userId, ...r.values }, { onConflict: "income_id,billing_month" });
  if (error) return dbFailure(error, "setIncomeOverride", "Couldn't save this month's amount. Please try again.");

  revalidatePath(PLANNER_PATH);
  revalidatePath(EXPENSES_PATH);
  return { error: null, ok: true };
}

// Expenses
/**
 * Reject an expense→debt link that isn't the user's own active debt. RLS scopes the
 * lookup, so a debt id that returns no row is either someone else's or doesn't exist.
 */
async function assertLinkedDebtOwned(debtId: string | null): Promise<FinanceActionState | null> {
  if (!debtId) return null;
  const { supabase, userId } = await requireUserId();
  if (!userId) return SIGNED_OUT;
  const { data, error } = await supabase
    .from("debts")
    .select("id")
    .eq("id", debtId)
    .is("archived_at", null)
    .maybeSingle();
  if (error) return dbFailure(error, "expense.linkDebt", "Couldn't verify the linked debt. Please try again.");
  if (!data) return { error: "That debt isn't available to link." };
  return null;
}

/** Same ownership guard for a savings-linked expense (RLS scopes the lookup to the owner). */
async function assertLinkedSavingsOwned(goalId: string | null): Promise<FinanceActionState | null> {
  if (!goalId) return null;
  const { supabase, userId } = await requireUserId();
  if (!userId) return SIGNED_OUT;
  const { data, error } = await supabase
    .from("savings_goals")
    .select("id")
    .eq("id", goalId)
    .is("archived_at", null)
    .maybeSingle();
  if (error) return dbFailure(error, "expense.linkSavings", "Couldn't verify the linked pot. Please try again.");
  if (!data) return { error: "That savings pot isn't available to link." };
  return null;
}

/**
 * `pct_of_income` only matters for the "offering" group (migration 0009). Omitting it for
 * every other expense keeps inserts/updates working even before that migration reaches the
 * DB — only the new offering feature depends on the column.
 */
function expensePayload(values: import("@/lib/finance/validation").ExpenseValues): Record<string, unknown> {
  const payload = { ...values } as Record<string, unknown>;
  if (values.expense_group !== "offering") delete payload.pct_of_income;
  // savings_goal_id (migration 0017) — omit when unset so writes stay safe before the column lands.
  if (!values.savings_goal_id) delete payload.savings_goal_id;
  return payload;
}

export async function createExpense(_p: FinanceActionState, formData: FormData): Promise<FinanceActionState> {
  const r = validateExpenseInput(Object.fromEntries(formData));
  if (!r.ok || !r.values) return { error: r.error };
  const linkError = (await assertLinkedDebtOwned(r.values.debt_id)) ?? (await assertLinkedSavingsOwned(r.values.savings_goal_id));
  if (linkError) return linkError;
  return insertOwned("expenses", EXPENSES_PATH, expensePayload(r.values));
}
export async function updateExpense(_p: FinanceActionState, formData: FormData): Promise<FinanceActionState> {
  const r = validateExpenseInput(Object.fromEntries(formData));
  if (!r.ok || !r.values) return { error: r.error };
  const linkError = (await assertLinkedDebtOwned(r.values.debt_id)) ?? (await assertLinkedSavingsOwned(r.values.savings_goal_id));
  if (linkError) return linkError;
  return updateOwned("expenses", EXPENSES_PATH, idOf(formData), expensePayload(r.values));
}
export async function archiveExpense(_p: FinanceActionState, formData: FormData): Promise<FinanceActionState> {
  return archiveOwned("expenses", EXPENSES_PATH, idOf(formData));
}

// Payment cards (migration 0021) — managed on the Expenses hub, so revalidate there.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createCard(_p: FinanceActionState, formData: FormData): Promise<FinanceActionState> {
  const r = validateCardInput(Object.fromEntries(formData));
  if (!r.ok || !r.values) return { error: r.error };
  return insertOwned("cards", EXPENSES_PATH, { ...r.values });
}
export async function updateCard(_p: FinanceActionState, formData: FormData): Promise<FinanceActionState> {
  const r = validateCardInput(Object.fromEntries(formData));
  if (!r.ok || !r.values) return { error: r.error };
  return updateOwned("cards", EXPENSES_PATH, idOf(formData), { ...r.values });
}
export async function archiveCard(_p: FinanceActionState, formData: FormData): Promise<FinanceActionState> {
  return archiveOwned("cards", EXPENSES_PATH, idOf(formData));
}

/** Reject a card tag that isn't the user's own active card (RLS scopes the lookup). */
async function assertLinkedCardOwned(cardId: string | null): Promise<FinanceActionState | null> {
  if (!cardId) return null;
  const { supabase, userId } = await requireUserId();
  if (!userId) return SIGNED_OUT;
  const { data, error } = await supabase
    .from("cards")
    .select("id")
    .eq("id", cardId)
    .is("archived_at", null)
    .maybeSingle();
  if (error) return dbFailure(error, "expense.linkCard", "Couldn't verify the card. Please try again.");
  if (!data) return { error: "That card isn't available." };
  return null;
}

/**
 * Tag (or clear) the payment card on a single expense. A blank `card_id` clears the tag.
 * Ownership of both the expense (RLS on the update) and the card (guard below) is enforced.
 */
export async function setExpenseCard(_p: FinanceActionState, formData: FormData): Promise<FinanceActionState> {
  const id = idOf(formData);
  if (!id) return { error: "Missing expense id." };

  const raw = String(formData.get("card_id") ?? "").trim();
  let card_id: string | null = null;
  if (raw !== "") {
    if (!UUID_RE.test(raw)) return { error: "Choose a valid card." };
    card_id = raw;
  }

  const linkError = await assertLinkedCardOwned(card_id);
  if (linkError) return linkError;

  return updateOwned("expenses", EXPENSES_PATH, id, { card_id });
}

/**
 * Tag (or clear) the payment card a debt's monthly payment is made on (migration 0022). Blank
 * clears it. Ownership of the debt (RLS on the update) and the card (guard) is enforced. Revalidates
 * both the Expenses hub (where debt bills live) and the Debts page.
 */
export async function setDebtCard(_p: FinanceActionState, formData: FormData): Promise<FinanceActionState> {
  const id = idOf(formData);
  if (!id) return { error: "Missing debt id." };

  const raw = String(formData.get("card_id") ?? "").trim();
  let card_id: string | null = null;
  if (raw !== "") {
    if (!UUID_RE.test(raw)) return { error: "Choose a valid card." };
    card_id = raw;
  }

  const linkError = await assertLinkedCardOwned(card_id);
  if (linkError) return linkError;

  const result = await updateOwned("debts", EXPENSES_PATH, id, { card_id });
  if (result.ok) revalidatePath(DEBTS_PATH);
  return result;
}

// Savings pots
/**
 * `type` only matters once migration 0012 lands; omitting it for "general" pots (the default)
 * keeps writes working before then — only typed pots depend on the column. `monthly_contribution`
 * (migration 0015) is likewise omitted when blank so writes stay safe before the column exists.
 */
function savingsPayload(values: import("@/lib/finance/validation").SavingsGoalValues): Record<string, unknown> {
  const payload = { ...values } as Record<string, unknown>;
  if (values.type === "general") delete payload.type;
  if (values.monthly_contribution === null) delete payload.monthly_contribution;
  // pct_of_income lands with migration 0018 — omit when unset so writes stay safe before then.
  if (values.pct_of_income === null) delete payload.pct_of_income;
  return payload;
}

export async function createSavingsGoal(_p: FinanceActionState, formData: FormData): Promise<FinanceActionState> {
  const r = validateSavingsGoalInput(Object.fromEntries(formData));
  if (!r.ok || !r.values) return { error: r.error };
  return insertOwned("savings_goals", SAVINGS_PATH, savingsPayload(r.values));
}
export async function updateSavingsGoal(_p: FinanceActionState, formData: FormData): Promise<FinanceActionState> {
  const r = validateSavingsGoalInput(Object.fromEntries(formData));
  if (!r.ok || !r.values) return { error: r.error };
  return updateOwned("savings_goals", SAVINGS_PATH, idOf(formData), savingsPayload(r.values));
}
export async function archiveSavingsGoal(_p: FinanceActionState, formData: FormData): Promise<FinanceActionState> {
  return archiveOwned("savings_goals", SAVINGS_PATH, idOf(formData));
}

/**
 * Record a deposit into a savings pot: a `contribution` transaction (tagged with
 * `savings_goal_id`) plus a read-modify-write bump of `savings_goals.current_amount` — same
 * shape as `adjustDebtBalance`. The pot is server-read (RLS-scoped) so the client can't move a
 * balance it doesn't own. Not atomic under true concurrency — fine for single-user manual entry.
 */
export async function addContribution(_p: FinanceActionState, formData: FormData): Promise<FinanceActionState> {
  const { supabase, userId } = await requireUserId();
  if (!userId) return SIGNED_OUT;

  const r = validateContributionInput(Object.fromEntries(formData));
  if (!r.ok || !r.values) return { error: r.error };
  const { savings_goal_id, amount, occurred_on } = r.values;

  const { data: goal, error: readErr } = await supabase
    .from("savings_goals")
    .select("current_amount")
    .eq("id", savings_goal_id)
    .is("archived_at", null)
    .maybeSingle();
  if (readErr) return dbFailure(readErr, "addContribution.read", "Couldn't load the pot. Please try again.");
  if (!goal) return { error: "That savings pot isn't available." };

  const { error: insertErr } = await supabase.from("transactions").insert({
    profile_id: userId,
    savings_goal_id,
    kind: "contribution",
    amount,
    ...(occurred_on ? { occurred_on } : {}),
  });
  if (insertErr) return dbFailure(insertErr, "addContribution.insert", "Couldn't record the contribution. Please try again.");

  const newAmount = round2(Number(goal.current_amount) + amount);
  const { error: bumpErr } = await supabase
    .from("savings_goals")
    .update({ current_amount: newAmount })
    .eq("id", savings_goal_id);
  if (bumpErr) {
    return dbFailure(
      bumpErr,
      "addContribution.bump",
      "Recorded the contribution, but the pot total didn't update. Refresh and check.",
    );
  }

  revalidatePath(SAVINGS_PATH);
  return { error: null, ok: true };
}

// The Budget page was folded into the Expenses hub (Phase 5C); revalidate there.
const PLANNER_PATH = "/app/expenses";
const ISO_MONTH = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Read-modify-write a debt's stored balance by one transaction. Returns a Result on a DB
 * error, or null on success / when the debt no longer exists. Floors at zero via
 * `applyTransactionToBalance` (a `payment` clamped at 0 over-restores on reversal — an
 * accepted edge case for single-user manual entry, same as `addTransaction`).
 */
async function adjustDebtBalance(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  debtId: string,
  kind: "payment" | "charge",
  amount: number,
): Promise<FinanceActionState | null> {
  const { data: debt, error: readErr } = await supabase
    .from("debts")
    .select("balance")
    .eq("id", debtId)
    .maybeSingle();
  if (readErr) return dbFailure(readErr, "togglePaid.balance.read", "Couldn't update the balance. Please try again.");
  if (!debt) return null; // debt archived/deleted — nothing to adjust
  const newBalance = applyTransactionToBalance(Number(debt.balance), kind, amount);
  const { error } = await supabase.from("debts").update({ balance: newBalance }).eq("id", debtId);
  if (error) return dbFailure(error, "togglePaid.balance.update", "Couldn't update the balance. Please try again.");
  return null;
}

/**
 * Interest/principal split for a debt payment of `amountPaid`: only the principal portion
 * (total − escrow − PMI − interest) reduces the balance on check-off. Returns null when the
 * debt is gone or unreadable (the payment is still recorded; the balance just isn't adjusted).
 */
async function debtSplit(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  debtId: string,
  amountPaid: number,
): Promise<{ interest: number; principal: number } | null> {
  const { data, error } = await supabase
    .from("debts")
    .select("balance, apr, escrow, pmi")
    .eq("id", debtId)
    .maybeSingle();
  if (error || !data) {
    if (error) captureError(error, { action: "togglePaid.split" });
    return null;
  }
  const s = splitPayment({
    balance: Number(data.balance),
    apr: Number(data.apr),
    total: amountPaid,
    escrow: data.escrow == null ? 0 : Number(data.escrow),
    pmi: data.pmi == null ? 0 : Number(data.pmi),
  });
  return { interest: s.interest, principal: s.principal };
}

/**
 * Planner "paid this month" toggle. Records (or removes) a `payment` transaction stamped
 * with `billing_month`, idempotent (one paid mark per item per month). For an expense
 * LINKED to a debt, the payment also draws down that debt's balance (and un-checking
 * restores it). Plain expenses and direct debt bills stay tracking-only — their balances
 * are managed on /app/debts.
 */
export async function togglePaid(_p: FinanceActionState, formData: FormData): Promise<FinanceActionState> {
  const { supabase, userId } = await requireUserId();
  if (!userId) return SIGNED_OUT;

  const kind = String(formData.get("kind") ?? "");
  const itemId = String(formData.get("item_id") ?? "").trim();
  const billingMonth = String(formData.get("billing_month") ?? "").trim();
  const checked = formData.get("checked") != null;
  if ((kind !== "expense" && kind !== "debt") || !itemId || !ISO_MONTH.test(billingMonth)) {
    return { error: "Couldn't update — bad request." };
  }
  const col = kind === "expense" ? "expense_id" : "debt_id";

  // For a linked expense, server-read the authoritative amount + debt link (never trust the
  // client). A direct debt bill (kind="debt") targets its own debt id.
  let linkedDebtId: string | null = null;
  let linkedSavingsId: string | null = null;
  let expenseAmount = 0;
  if (kind === "expense") {
    // select("*") so a missing savings_goal_id column (pre-0017) degrades gracefully.
    const { data: exp, error: expErr } = await supabase
      .from("expenses")
      .select("*")
      .eq("id", itemId)
      .maybeSingle();
    if (expErr) return dbFailure(expErr, "togglePaid.readExpense", "Couldn't update. Please try again.");
    if (!exp) return { error: "Expense not found." };
    linkedDebtId = (exp.debt_id as string | null) ?? null;
    linkedSavingsId = ((exp as { savings_goal_id?: string | null }).savings_goal_id as string | null) ?? null;
    expenseAmount = Number(exp.amount);
  }
  // The debt this check-off draws down (a linked expense's debt, or the debt bill itself).
  const targetDebtId = kind === "debt" ? itemId : linkedDebtId;

  if (checked) {
    const { data: existing } = await supabase
      .from("transactions")
      .select("id")
      .eq(col, itemId)
      .eq("billing_month", billingMonth)
      .eq("kind", "payment")
      .limit(1);
    if (!existing || existing.length === 0) {
      // amount must be > 0 (column check); use the planned amount, floored at one cent.
      const planned = kind === "expense" ? expenseAmount : (parseMoney(formData.get("amount")) ?? 0);
      const amount = Math.max(round2(planned), 0.01);

      // A debt payment (linked expense or debt bill) draws the balance down by PRINCIPAL only
      // (total − escrow − PMI − interest); the split is recorded on the transaction. Plain
      // expenses stay tracking-only.
      let interest: number | null = null;
      let principal: number | null = null;
      if (targetDebtId) {
        const split = await debtSplit(supabase, targetDebtId, amount);
        if (split) {
          interest = split.interest;
          principal = split.principal;
        }
      }

      const { error } = await supabase.from("transactions").insert({
        profile_id: userId,
        [col]: itemId,
        ...(linkedDebtId ? { debt_id: linkedDebtId } : {}),
        ...(linkedSavingsId ? { savings_goal_id: linkedSavingsId } : {}),
        kind: "payment",
        amount,
        ...(interest != null ? { interest } : {}),
        ...(principal != null ? { principal } : {}),
        billing_month: billingMonth,
      });
      if (error) return dbFailure(error, "togglePaid.insert", "Couldn't mark it paid. Please try again.");
      // Draw the debt balance down by the principal portion.
      if (targetDebtId && principal != null) {
        const adj = await adjustDebtBalance(supabase, targetDebtId, "payment", principal);
        if (adj) return adj;
      }
      // A savings-linked expense contributes to the pot — bump its current_amount.
      if (linkedSavingsId) {
        const adj = await adjustSavingsAmount(supabase, linkedSavingsId, amount);
        if (adj) return adj;
      }
    }
  } else {
    // Read before deleting so a linked expense's reduction can be reversed (charge it back).
    const { data: removed, error: readErr } = await supabase
      .from("transactions")
      .select("amount, debt_id, savings_goal_id, principal")
      .eq(col, itemId)
      .eq("billing_month", billingMonth)
      .eq("kind", "payment");
    if (readErr) return dbFailure(readErr, "togglePaid.read", "Couldn't update. Please try again.");
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq(col, itemId)
      .eq("billing_month", billingMonth)
      .eq("kind", "payment");
    if (error) return dbFailure(error, "togglePaid.delete", "Couldn't update. Please try again.");
    // Reverse any balance/pot change this payment made. Debt: charge back the principal
    // (legacy rows fall back to amount). Savings: decrement the pot by the amount.
    for (const t of (removed ?? []) as {
      amount: number;
      debt_id: string | null;
      savings_goal_id: string | null;
      principal: number | null;
    }[]) {
      if (t.debt_id) {
        const back = t.principal != null ? Number(t.principal) : Number(t.amount);
        const adj = await adjustDebtBalance(supabase, t.debt_id, "charge", back);
        if (adj) return adj;
      }
      if (t.savings_goal_id) {
        const adj = await adjustSavingsAmount(supabase, t.savings_goal_id, -Number(t.amount));
        if (adj) return adj;
      }
    }
  }

  revalidatePath(PLANNER_PATH);
  revalidatePath(EXPENSES_PATH);
  revalidatePath(DEBTS_PATH);
  revalidatePath(SAVINGS_PATH);
  return { error: null, ok: true };
}

/** Bump a savings pot's current_amount by `delta` (negative to decrement; floored at 0). */
async function adjustSavingsAmount(
  supabase: Awaited<ReturnType<typeof requireUserId>>["supabase"],
  goalId: string,
  delta: number,
): Promise<FinanceActionState | null> {
  const { data: g, error: readErr } = await supabase
    .from("savings_goals")
    .select("current_amount")
    .eq("id", goalId)
    .maybeSingle();
  if (readErr) return dbFailure(readErr, "adjustSavings.read", "Couldn't update the pot. Please try again.");
  if (!g) return null;
  const next = Math.max(0, round2(Number(g.current_amount) + delta));
  const { error } = await supabase.from("savings_goals").update({ current_amount: next }).eq("id", goalId);
  if (error) return dbFailure(error, "adjustSavings.update", "Couldn't update the pot total. Refresh and check.");
  return null;
}

/**
 * Savings "contributed this month" toggle. Records (or removes) a `contribution` transaction
 * stamped with `billing_month` (idempotent, one per pot per month) and bumps/decrements
 * `savings_goals.current_amount` — the same effect as `addContribution`, made reversible.
 */
export async function toggleSavingsPaid(_p: FinanceActionState, formData: FormData): Promise<FinanceActionState> {
  const { supabase, userId } = await requireUserId();
  if (!userId) return SIGNED_OUT;

  const goalId = String(formData.get("item_id") ?? "").trim();
  const billingMonth = String(formData.get("billing_month") ?? "").trim();
  const checked = formData.get("checked") != null;
  if (!goalId || !ISO_MONTH.test(billingMonth)) return { error: "Couldn't update — bad request." };

  if (checked) {
    const { data: existing } = await supabase
      .from("transactions")
      .select("id")
      .eq("savings_goal_id", goalId)
      .eq("billing_month", billingMonth)
      .eq("kind", "contribution")
      .limit(1);
    if (existing && existing.length > 0) {
      revalidatePath(EXPENSES_PATH);
      return { error: null, ok: true };
    }
    const amount = Math.max(round2(parseMoney(formData.get("amount")) ?? 0), 0.01);
    const { data: goal, error: readErr } = await supabase
      .from("savings_goals")
      .select("current_amount")
      .eq("id", goalId)
      .is("archived_at", null)
      .maybeSingle();
    if (readErr) return dbFailure(readErr, "toggleSavingsPaid.read", "Couldn't update. Please try again.");
    if (!goal) return { error: "That savings pot isn't available." };
    const { error: insErr } = await supabase.from("transactions").insert({
      profile_id: userId,
      savings_goal_id: goalId,
      kind: "contribution",
      amount,
      billing_month: billingMonth,
    });
    if (insErr) return dbFailure(insErr, "toggleSavingsPaid.insert", "Couldn't record it. Please try again.");
    const { error: bumpErr } = await supabase
      .from("savings_goals")
      .update({ current_amount: round2(Number(goal.current_amount) + amount) })
      .eq("id", goalId);
    if (bumpErr) return dbFailure(bumpErr, "toggleSavingsPaid.bump", "Recorded it, but the pot total didn't update. Refresh.");
  } else {
    const { data: removed, error: readErr } = await supabase
      .from("transactions")
      .select("amount")
      .eq("savings_goal_id", goalId)
      .eq("billing_month", billingMonth)
      .eq("kind", "contribution");
    if (readErr) return dbFailure(readErr, "toggleSavingsPaid.readDel", "Couldn't update. Please try again.");
    const { error: delErr } = await supabase
      .from("transactions")
      .delete()
      .eq("savings_goal_id", goalId)
      .eq("billing_month", billingMonth)
      .eq("kind", "contribution");
    if (delErr) return dbFailure(delErr, "toggleSavingsPaid.delete", "Couldn't update. Please try again.");
    const back = ((removed ?? []) as { amount: number }[]).reduce((s, t) => s + Number(t.amount), 0);
    if (back > 0) {
      const { data: goal } = await supabase.from("savings_goals").select("current_amount").eq("id", goalId).maybeSingle();
      if (goal) {
        await supabase
          .from("savings_goals")
          .update({ current_amount: Math.max(0, round2(Number(goal.current_amount) - back)) })
          .eq("id", goalId);
      }
    }
  }

  revalidatePath(EXPENSES_PATH);
  revalidatePath(SAVINGS_PATH);
  return { error: null, ok: true };
}

/**
 * "Pay all this month" — marks every active expense paid for `billingMonth` (idempotent: skips
 * those already paid), recording each payment and drawing linked debts down by principal. Same
 * per-item semantics as `togglePaid`'s check path, applied in bulk.
 */
export async function payAllExpenses(_p: FinanceActionState, formData: FormData): Promise<FinanceActionState> {
  const { supabase, userId } = await requireUserId();
  if (!userId) return SIGNED_OUT;

  const billingMonth = String(formData.get("billing_month") ?? "").trim();
  if (!ISO_MONTH.test(billingMonth)) return { error: "Couldn't update — bad request." };

  const [expensesRes, debtsRes, savingsRes, paidRes, contribRes, incomesRes, overridesRes] = await Promise.all([
    // select("*") so a missing savings_goal_id column (pre-0017) reads as undefined.
    supabase.from("expenses").select("*").is("archived_at", null),
    supabase.from("debts").select("id, min_payment").is("archived_at", null),
    // select("*") so a missing monthly_contribution/pct_of_income column (pre-0015/0018) reads as undefined.
    supabase.from("savings_goals").select("*").is("archived_at", null),
    supabase.from("transactions").select("expense_id, debt_id").eq("kind", "payment").eq("billing_month", billingMonth),
    supabase.from("transactions").select("savings_goal_id").eq("kind", "contribution").eq("billing_month", billingMonth),
    // Incomes + this month's variable actuals — needed to resolve percent-of-income savings bills.
    supabase.from("incomes").select("*").is("archived_at", null),
    supabase.from("income_overrides").select("income_id, amount").eq("billing_month", billingMonth),
  ]);
  if (expensesRes.error) return dbFailure(expensesRes.error, "payAll.expenses", "Couldn't load expenses. Please try again.");
  if (debtsRes.error) return dbFailure(debtsRes.error, "payAll.debts", "Couldn't load debts. Please try again.");
  if (savingsRes.error) return dbFailure(savingsRes.error, "payAll.savings", "Couldn't load savings. Please try again.");
  if (paidRes.error) return dbFailure(paidRes.error, "payAll.paid", "Couldn't load payments. Please try again.");
  if (contribRes.error) return dbFailure(contribRes.error, "payAll.contrib", "Couldn't load contributions. Please try again.");

  const expenses = (expensesRes.data ?? []) as {
    id: string;
    amount: number;
    debt_id: string | null;
    savings_goal_id?: string | null;
  }[];
  const payments = (paidRes.data ?? []) as { expense_id: string | null; debt_id: string | null }[];
  const paidExpenseIds = new Set(payments.map((t) => t.expense_id).filter(Boolean));
  const paidDebtIds = new Set(payments.map((t) => t.debt_id).filter(Boolean));
  // A debt represented by a linked expense is paid via that expense — don't double-pay it.
  const linkedDebtIds = new Set(expenses.map((e) => e.debt_id).filter(Boolean));

  for (const e of expenses) {
    if (paidExpenseIds.has(e.id)) continue;
    const amount = Math.max(round2(Number(e.amount)), 0.01);
    let interest: number | null = null;
    let principal: number | null = null;
    if (e.debt_id) {
      const split = await debtSplit(supabase, e.debt_id, amount);
      if (split) {
        interest = split.interest;
        principal = split.principal;
      }
    }
    const { error } = await supabase.from("transactions").insert({
      profile_id: userId,
      expense_id: e.id,
      ...(e.debt_id ? { debt_id: e.debt_id } : {}),
      ...(e.savings_goal_id ? { savings_goal_id: e.savings_goal_id } : {}),
      kind: "payment",
      amount,
      ...(interest != null ? { interest } : {}),
      ...(principal != null ? { principal } : {}),
      billing_month: billingMonth,
    });
    if (error) return dbFailure(error, "payAll.insert", "Couldn't mark everything paid. Please try again.");
    if (e.debt_id && principal != null) {
      const adj = await adjustDebtBalance(supabase, e.debt_id, "payment", principal);
      if (adj) return adj;
    }
    if (e.savings_goal_id) {
      const adj = await adjustSavingsAmount(supabase, e.savings_goal_id, amount);
      if (adj) return adj;
    }
  }

  // Unlinked debts pay their minimum (principal portion draws the balance down).
  for (const d of (debtsRes.data ?? []) as { id: string; min_payment: number }[]) {
    if (linkedDebtIds.has(d.id) || paidDebtIds.has(d.id)) continue;
    const amount = Math.max(round2(Number(d.min_payment)), 0.01);
    const split = await debtSplit(supabase, d.id, amount);
    const { error } = await supabase.from("transactions").insert({
      profile_id: userId,
      debt_id: d.id,
      kind: "payment",
      amount,
      ...(split ? { interest: split.interest, principal: split.principal } : {}),
      billing_month: billingMonth,
    });
    if (error) return dbFailure(error, "payAll.debtInsert", "Couldn't mark everything paid. Please try again.");
    if (split) {
      const adj = await adjustDebtBalance(supabase, d.id, "payment", split.principal);
      if (adj) return adj;
    }
  }

  // Recurring savings record a contribution + bump the pot. A pot contributes a fixed
  // monthly_contribution OR a percent of total monthly income (pct_of_income) — resolve the
  // percent with the same income math the Expenses page uses so the amounts match.
  const totalIncome = buildMonthlyPlan({
    incomes: (incomesRes.data ?? []) as Income[],
    expenses: [],
    debts: [],
    overrides: Object.fromEntries(
      ((overridesRes.data ?? []) as { income_id: string; amount: number }[]).map((o) => [o.income_id, Number(o.amount)]),
    ),
  }).income;
  const paidSavingsIds = new Set(
    ((contribRes.data ?? []) as { savings_goal_id: string | null }[]).map((t) => t.savings_goal_id).filter(Boolean),
  );
  for (const g of (savingsRes.data ?? []) as {
    id: string;
    current_amount: number;
    monthly_contribution: number | null;
    pct_of_income?: number | null;
  }[]) {
    const monthly =
      g.monthly_contribution != null && Number(g.monthly_contribution) > 0
        ? Number(g.monthly_contribution)
        : g.pct_of_income != null && Number(g.pct_of_income) > 0
          ? round2((totalIncome * Number(g.pct_of_income)) / 100)
          : 0;
    if (monthly <= 0 || paidSavingsIds.has(g.id)) continue;
    const amount = round2(monthly);
    const { error: insErr } = await supabase.from("transactions").insert({
      profile_id: userId,
      savings_goal_id: g.id,
      kind: "contribution",
      amount,
      billing_month: billingMonth,
    });
    if (insErr) return dbFailure(insErr, "payAll.savingsInsert", "Couldn't mark everything paid. Please try again.");
    const { error: bumpErr } = await supabase
      .from("savings_goals")
      .update({ current_amount: round2(Number(g.current_amount) + amount) })
      .eq("id", g.id);
    if (bumpErr) return dbFailure(bumpErr, "payAll.savingsBump", "Recorded contributions, but a pot total didn't update. Refresh.");
  }

  revalidatePath(EXPENSES_PATH);
  revalidatePath(PLANNER_PATH);
  revalidatePath(SAVINGS_PATH);
  revalidatePath(DEBTS_PATH);
  return { error: null, ok: true };
}

/**
 * "Revert" — the inverse of payAllExpenses for a month: charge each debt back by the principal
 * its payment deducted, decrement each savings pot by its contribution, then delete the month's
 * payment + contribution transactions. Same per-item semantics as un-checking, applied in bulk.
 */
export async function revertAllExpenses(_p: FinanceActionState, formData: FormData): Promise<FinanceActionState> {
  const { supabase, userId } = await requireUserId();
  if (!userId) return SIGNED_OUT;

  const billingMonth = String(formData.get("billing_month") ?? "").trim();
  if (!ISO_MONTH.test(billingMonth)) return { error: "Couldn't update — bad request." };

  const [payRes, contribRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("debt_id, savings_goal_id, principal, amount")
      .eq("kind", "payment")
      .eq("billing_month", billingMonth),
    supabase
      .from("transactions")
      .select("savings_goal_id, amount")
      .eq("kind", "contribution")
      .eq("billing_month", billingMonth),
  ]);
  if (payRes.error) return dbFailure(payRes.error, "revertAll.payments", "Couldn't load payments. Please try again.");
  if (contribRes.error) return dbFailure(contribRes.error, "revertAll.contrib", "Couldn't load contributions. Please try again.");

  // Reverse each payment: charge debts back by principal; decrement savings-linked pots by amount.
  for (const t of (payRes.data ?? []) as {
    debt_id: string | null;
    savings_goal_id: string | null;
    principal: number | null;
    amount: number;
  }[]) {
    if (t.debt_id) {
      const back = t.principal != null ? Number(t.principal) : Number(t.amount);
      const adj = await adjustDebtBalance(supabase, t.debt_id, "charge", back);
      if (adj) return adj;
    }
    if (t.savings_goal_id) {
      const adj = await adjustSavingsAmount(supabase, t.savings_goal_id, -Number(t.amount));
      if (adj) return adj;
    }
  }

  // Decrement each savings pot by its contribution (never below zero).
  for (const t of (contribRes.data ?? []) as { savings_goal_id: string | null; amount: number }[]) {
    if (!t.savings_goal_id) continue;
    const { data: g } = await supabase
      .from("savings_goals")
      .select("current_amount")
      .eq("id", t.savings_goal_id)
      .maybeSingle();
    if (g) {
      const next = Math.max(0, round2(Number(g.current_amount) - Number(t.amount)));
      const { error } = await supabase.from("savings_goals").update({ current_amount: next }).eq("id", t.savings_goal_id);
      if (error) return dbFailure(error, "revertAll.savingsDec", "Couldn't update a pot total. Refresh.");
    }
  }

  const { error: delErr } = await supabase
    .from("transactions")
    .delete()
    .in("kind", ["payment", "contribution"])
    .eq("billing_month", billingMonth);
  if (delErr) return dbFailure(delErr, "revertAll.delete", "Couldn't revert this month. Please try again.");

  revalidatePath(EXPENSES_PATH);
  revalidatePath(PLANNER_PATH);
  revalidatePath(SAVINGS_PATH);
  revalidatePath(DEBTS_PATH);
  return { error: null, ok: true };
}
