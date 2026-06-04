import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { TEST_USER, hasTestCreds, hasServiceRole, uiLogin } from "./helpers/auth";

/**
 * N4: portfolio export + import, and (safely) account deletion. Export/import run against
 * the shared test user; deletion runs against a THROWAWAY user created via the admin API so
 * the shared fixture is never destroyed.
 */
test.skip(!hasTestCreds(), "Set TEST_USER_EMAIL / TEST_USER_PASSWORD to run the N4 E2E");

const importedDebt = `e2e-n4-import-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

function ownerClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
function adminClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

test.afterAll(async () => {
  if (!hasTestCreds()) return;
  const c = ownerClient();
  await c.auth.signInWithPassword({ email: TEST_USER.email, password: TEST_USER.password });
  await c.from("debts").delete().eq("name", importedDebt);
});

test("export downloads a versioned JSON backup", async ({ page }) => {
  await uiLogin(page);
  await expect(page).toHaveURL(/\/app(\/|$)/);
  await page.goto("/app/settings");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export backup" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^nzx-backup-.*\.json$/);
  const path = await download.path();
  const { readFileSync } = await import("node:fs");
  const doc = JSON.parse(readFileSync(path, "utf8"));
  expect(doc.version).toBe(1);
  expect(Array.isArray(doc.data.debts)).toBe(true);
  expect(Array.isArray(doc.data.transactions)).toBe(true);
});

test("import a backup restores its entities under the account", async ({ page }) => {
  await uiLogin(page);
  await expect(page).toHaveURL(/\/app(\/|$)/);
  await page.goto("/app/settings");

  const backup = {
    version: 1,
    exportedAt: "2026-06-04T00:00:00Z",
    data: {
      debts: [{ id: "imp-1", name: importedDebt, type: "credit_card", balance: 555, apr: 0, min_payment: 0 }],
      incomes: [],
      expenses: [],
      savings_goals: [],
      transactions: [],
    },
  };
  await page.getByLabel("Import backup file").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(page.getByText(/Restored 1 debts/i)).toBeVisible();

  // The imported debt is now real and owned by this user.
  await page.goto("/app/debts");
  await expect(page.getByRole("list", { name: "Debts" }).locator("li", { hasText: importedDebt })).toBeVisible();
});

test("delete account removes a throwaway user", async ({ page }) => {
  test.skip(!hasServiceRole(), "Set SUPABASE_SERVICE_ROLE_KEY to run the deletion test");

  const admin = adminClient();
  const email = `e2e-del-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@nzxus.com`;
  const password = "Str0ng-e2e-pw!42";
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  expect(createErr).toBeNull();
  const userId = created.user!.id;

  try {
    page.on("dialog", (d) => d.accept());
    await uiLogin(page, { email, password });
    await expect(page).toHaveURL(/\/app(\/|$)/);
    await page.goto("/app/settings");

    await page.getByLabel("Confirm your email to delete the account").fill(email);
    await page.getByRole("button", { name: "Delete my account" }).click();

    // Redirected to the landing page, and the auth user is gone.
    await expect(page).toHaveURL(/\/$|\/(\?.*)?$/);
    const { data: lookup } = await admin.auth.admin.getUserById(userId);
    expect(lookup.user).toBeNull();
  } finally {
    // Best-effort cleanup if the test failed before deletion.
    await admin.auth.admin.deleteUser(userId).catch(() => {});
  }
});
