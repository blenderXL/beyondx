/**
 * Password policy — shared by the client (live strength hints) and the server
 * actions (enforcement). Supabase enforces the same rules server-side as
 * defense-in-depth; this keeps the UX and the gate in agreement.
 */

export const MIN_PASSWORD_LENGTH = 10;

export interface PasswordCheck {
  label: string;
  ok: boolean;
}

/** Per-requirement breakdown, used to render live hints on the signup form. */
export function passwordChecks(password: string): PasswordCheck[] {
  return [
    {
      label: `At least ${MIN_PASSWORD_LENGTH} characters`,
      ok: password.length >= MIN_PASSWORD_LENGTH,
    },
    { label: "A lowercase letter", ok: /[a-z]/.test(password) },
    { label: "An uppercase letter", ok: /[A-Z]/.test(password) },
    { label: "A number", ok: /[0-9]/.test(password) },
    { label: "A symbol", ok: /[^A-Za-z0-9]/.test(password) },
  ];
}

/** Pass/fail verdict for the whole policy. `fails` lists the unmet requirements. */
export function validatePassword(password: string): { ok: boolean; fails: string[] } {
  const fails = passwordChecks(password)
    .filter((check) => !check.ok)
    .map((check) => check.label);
  return { ok: fails.length === 0, fails };
}
