"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  validateDebtInput,
  validateExpenseInput,
  validateIncomeInput,
  validateSavingsGoalInput,
  validateTransactionInput,
  parseMoney,
  round2,
} from "@/lib/finance/validation";
import { applyTransactionToBalance } from "@/lib/finance/balance";
import { captureError } from "@/lib/telemetry/capture";
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

export async function createDebt(
  _prev: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  const { supabase, userId } = await requireUserId();
  if (!userId) return { error: "You're signed out. Log in and try again." };

  const result = validateDebtInput(Object.fromEntries(formData));
  if (!result.ok || !result.values) return { error: result.error };

  // Capture the starting balance as the baseline for "% paid off" — the user only
  // ever types current balance; the baseline stays fixed as they pay it down.
  const { error } = await supabase
    .from("debts")
    .insert({ profile_id: userId, ...result.values, original_balance: result.values.balance });
  if (error) return dbFailure(error, "createDebt", "Couldn't save the debt. Please try again.");

  revalidatePath(DEBTS_PATH);
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
    .update(result.values)
    .eq("id", id)
    .select("id");
  if (error) return dbFailure(error, "updateDebt", "Couldn't update the debt. Please try again.");
  if (!data || data.length === 0) return { error: "Debt not found." };

  revalidatePath(DEBTS_PATH);
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
  return { error: null, ok: true };
}

/* ---- Phase 2: income / expenses / savings ----
 * Same shape as the debt actions: server-side validation, explicit `profile_id` on
 * insert, RLS scoping every write, and `.select("id")` to distinguish "not yours /
 * wrong id" from a real DB error. Soft-delete via `archived_at`. The three owner-scoped
 * helpers remove the create/update/archive boilerplate; the validators guarantee the
 * value shape, so the row payload is passed through opaquely. */

const INCOME_PATH = "/app/income";
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
export async function createIncome(_p: FinanceActionState, formData: FormData): Promise<FinanceActionState> {
  const r = validateIncomeInput(Object.fromEntries(formData));
  if (!r.ok || !r.values) return { error: r.error };
  return insertOwned("incomes", INCOME_PATH, r.values as unknown as Record<string, unknown>);
}
export async function updateIncome(_p: FinanceActionState, formData: FormData): Promise<FinanceActionState> {
  const r = validateIncomeInput(Object.fromEntries(formData));
  if (!r.ok || !r.values) return { error: r.error };
  return updateOwned("incomes", INCOME_PATH, idOf(formData), r.values as unknown as Record<string, unknown>);
}
export async function archiveIncome(_p: FinanceActionState, formData: FormData): Promise<FinanceActionState> {
  return archiveOwned("incomes", INCOME_PATH, idOf(formData));
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

export async function createExpense(_p: FinanceActionState, formData: FormData): Promise<FinanceActionState> {
  const r = validateExpenseInput(Object.fromEntries(formData));
  if (!r.ok || !r.values) return { error: r.error };
  const linkError = await assertLinkedDebtOwned(r.values.debt_id);
  if (linkError) return linkError;
  return insertOwned("expenses", EXPENSES_PATH, r.values as unknown as Record<string, unknown>);
}
export async function updateExpense(_p: FinanceActionState, formData: FormData): Promise<FinanceActionState> {
  const r = validateExpenseInput(Object.fromEntries(formData));
  if (!r.ok || !r.values) return { error: r.error };
  const linkError = await assertLinkedDebtOwned(r.values.debt_id);
  if (linkError) return linkError;
  return updateOwned("expenses", EXPENSES_PATH, idOf(formData), r.values as unknown as Record<string, unknown>);
}
export async function archiveExpense(_p: FinanceActionState, formData: FormData): Promise<FinanceActionState> {
  return archiveOwned("expenses", EXPENSES_PATH, idOf(formData));
}

// Savings pots
export async function createSavingsGoal(_p: FinanceActionState, formData: FormData): Promise<FinanceActionState> {
  const r = validateSavingsGoalInput(Object.fromEntries(formData));
  if (!r.ok || !r.values) return { error: r.error };
  return insertOwned("savings_goals", SAVINGS_PATH, r.values as unknown as Record<string, unknown>);
}
export async function updateSavingsGoal(_p: FinanceActionState, formData: FormData): Promise<FinanceActionState> {
  const r = validateSavingsGoalInput(Object.fromEntries(formData));
  if (!r.ok || !r.values) return { error: r.error };
  return updateOwned("savings_goals", SAVINGS_PATH, idOf(formData), r.values as unknown as Record<string, unknown>);
}
export async function archiveSavingsGoal(_p: FinanceActionState, formData: FormData): Promise<FinanceActionState> {
  return archiveOwned("savings_goals", SAVINGS_PATH, idOf(formData));
}

const PLANNER_PATH = "/app/planner";
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
  // client). This is the only path that moves a debt balance.
  let linkedDebtId: string | null = null;
  let expenseAmount = 0;
  if (kind === "expense") {
    const { data: exp, error: expErr } = await supabase
      .from("expenses")
      .select("amount, debt_id")
      .eq("id", itemId)
      .maybeSingle();
    if (expErr) return dbFailure(expErr, "togglePaid.readExpense", "Couldn't update. Please try again.");
    if (!exp) return { error: "Expense not found." };
    linkedDebtId = (exp.debt_id as string | null) ?? null;
    expenseAmount = Number(exp.amount);
  }

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
      const { error } = await supabase.from("transactions").insert({
        profile_id: userId,
        [col]: itemId,
        ...(linkedDebtId ? { debt_id: linkedDebtId } : {}),
        kind: "payment",
        amount,
        billing_month: billingMonth,
      });
      if (error) return dbFailure(error, "togglePaid.insert", "Couldn't mark it paid. Please try again.");
      // Linked expense → draw the debt balance down.
      if (linkedDebtId) {
        const adj = await adjustDebtBalance(supabase, linkedDebtId, "payment", amount);
        if (adj) return adj;
      }
    }
  } else {
    // Read before deleting so a linked expense's reduction can be reversed (charge it back).
    const { data: removed, error: readErr } = await supabase
      .from("transactions")
      .select("amount, debt_id")
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
    // Reverse balance reductions from linked-expense payments (those carry debt_id). Direct
    // debt-bill payments never moved a balance, so this only fires for the linked path.
    if (kind === "expense") {
      for (const t of (removed ?? []) as { amount: number; debt_id: string | null }[]) {
        if (t.debt_id) {
          const adj = await adjustDebtBalance(supabase, t.debt_id, "charge", Number(t.amount));
          if (adj) return adj;
        }
      }
    }
  }

  revalidatePath(PLANNER_PATH);
  revalidatePath(DEBTS_PATH);
  return { error: null, ok: true };
}
