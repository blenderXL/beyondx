/**
 * Shared state shape for the auth Server Actions (used with `useActionState`).
 * Kept out of the `"use server"` module because those may only export async
 * functions — a type + constant has to live in a plain module.
 */

export interface AuthActionState {
  /** Generic, non-enumerating error message, or null. */
  error: string | null;
  /** Set on success for actions that show an inline confirmation instead of redirecting. */
  ok?: boolean;
}

export const INITIAL_AUTH_STATE: AuthActionState = { error: null };
