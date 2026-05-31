import { type Page, expect } from "@playwright/test";
import { TOTP, Secret } from "otpauth";

/**
 * Seeded dev users. Credentials come ONLY from env (never committed) — set them
 * in .env.local locally and as CI secrets. Specs that log in skip when these are
 * absent (see `hasTestCreds`). Keep names in sync with scripts/seed-test-user.ts.
 */
export const TEST_USER = {
  email: process.env.TEST_USER_EMAIL ?? "",
  password: process.env.TEST_USER_PASSWORD ?? "",
};
export const MFA_USER = {
  email: process.env.TEST_MFA_USER_EMAIL ?? "",
  password: process.env.TEST_MFA_USER_PASSWORD ?? "",
};

/** True when the password-login user's credentials are configured in the env. */
export function hasTestCreds(): boolean {
  return Boolean(TEST_USER.email && TEST_USER.password);
}

/** True when the MFA user's credentials are configured in the env. */
export function hasMfaCreds(): boolean {
  return Boolean(MFA_USER.email && MFA_USER.password);
}

/** Current 6-digit TOTP for a base32 secret (matches Supabase's defaults). */
export function totpCode(secret: string): string {
  return new TOTP({ secret: Secret.fromBase32(secret), digits: 6, period: 30 }).generate();
}

/** Log in through the UI with email + password. Does not assert the landing URL. */
export async function uiLogin(page: Page, creds = TEST_USER) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(creds.email);
  await page.getByLabel("Password", { exact: true }).fill(creds.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
}

/**
 * MFA tests need a deterministic clean slate. Verified factors can only be
 * removed at AAL2, so we delete them through the GoTrue admin REST API
 * (service-role) which bypasses that requirement. Requires
 * SUPABASE_SERVICE_ROLE_KEY — use `hasServiceRole()` to gate the spec.
 */
export function hasServiceRole(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL);
}

async function adminFetch(path: string, init?: RequestInit) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return fetch(`${url}/auth/v1${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

export async function clearMfaFactors(email: string): Promise<void> {
  if (!hasServiceRole()) return;
  const res = await adminFetch(`/admin/users?per_page=200`);
  if (!res.ok) return;
  const body = (await res.json()) as {
    users?: Array<{ id: string; email?: string; factors?: Array<{ id: string }> }>;
  };
  const user = body.users?.find((u) => u.email === email);
  for (const factor of user?.factors ?? []) {
    await adminFetch(`/admin/users/${user!.id}/factors/${factor.id}`, { method: "DELETE" });
  }
}

/** Convenience assertion used across specs. */
export async function expectOnApp(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/app(\/|$)/);
}
