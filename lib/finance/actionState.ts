/**
 * Shared state shape for the finance Server Actions (used with `useActionState`).
 * Mirrors `AuthActionState`. Kept out of the `"use server"` module because those
 * may only export async functions — a type + constant has to live in a plain module.
 */

export interface FinanceActionState {
  /** Human-readable error message naming what went wrong, or null. */
  error: string | null;
  /** Set on success for actions that show an inline confirmation instead of redirecting. */
  ok?: boolean;
}

export const INITIAL_FINANCE_STATE: FinanceActionState = { error: null };
