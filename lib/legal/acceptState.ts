/**
 * Action state for the legal consent gate. Kept out of the `"use server"` actions file, which
 * may only export async functions — the initial-state object + type live here (mirrors
 * lib/auth/authState.ts and lib/finance/actionState.ts).
 */
export interface AcceptLegalState {
  error: string | null;
  ok?: boolean;
}

export const INITIAL_ACCEPT_STATE: AcceptLegalState = { error: null };
