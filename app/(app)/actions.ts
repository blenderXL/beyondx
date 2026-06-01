"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  validateDebtInput,
  validateExpenseInput,
  validateIncomeInput,
  validateSavingsGoalInput,
  validateTransactionInput,
} from "@/lib/finance/validation";
import { applyTransactionToBalance } from "@/lib/finance/balance";
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
  if (error) return { error: "Couldn't save the debt. Please try again." };

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

  const result = validateDebtInput(Object.fromEntries(formData));
  if (!result.ok || !result.values) return { error: result.error };

  // `.select()` lets us tell "updated nothing" (wrong id / not yours via RLS) from a real error.
  const { data, error } = await supabase
    .from("debts")
    .update(result.values)
    .eq("id", id)
    .select("id");
  if (error) return { error: "Couldn't update the debt. Please try again." };
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
  if (error) return { error: "Couldn't archive the debt. Please try again." };
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
  if (readError) return { error: "Couldn't load the debt. Please try again." };
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
  if (insertError) return { error: "Couldn't record the transaction. Please try again." };

  const { error: balanceError } = await supabase
    .from("debts")
    .update({ balance: newBalance })
    .eq("id", debtId);
  if (balanceError) {
    return { error: "Recorded the transaction, but the balance didn't update. Refresh and check." };
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
  if (error) return { error: "Couldn't save. Please try again." };
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
  if (error) return { error: "Couldn't update. Please try again." };
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
  if (error) return { error: "Couldn't archive. Please try again." };
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
export async function createExpense(_p: FinanceActionState, formData: FormData): Promise<FinanceActionState> {
  const r = validateExpenseInput(Object.fromEntries(formData));
  if (!r.ok || !r.values) return { error: r.error };
  return insertOwned("expenses", EXPENSES_PATH, r.values as unknown as Record<string, unknown>);
}
export async function updateExpense(_p: FinanceActionState, formData: FormData): Promise<FinanceActionState> {
  const r = validateExpenseInput(Object.fromEntries(formData));
  if (!r.ok || !r.values) return { error: r.error };
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
