import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { TEST_USER, hasTestCreds, hasServiceRole, uiLogin } from "./helpers/auth";

/**
 * Phase 4 — variable monthly income. Marking a source variable and setting this month's
 * actual on the Budget page both need migration 0010 (incomes.is_variable +
 * income_overrides). The spec auto-skips until that's applied to nzx-dev. The income-form
 * checkbox renders regardless (no DB dependency), so that part is unconditional.
 */
test.skip(!hasTestCreds() || !hasServiceRole(), "Set TEST_USER_* and SUPABASE_SERVICE_ROLE_KEY for P4 E2E");

const PREFIX = `e2e-p4-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const SOURCE = `${PREFIX}-gig`;

function ownerClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
async function setFlag(key: string, enabled: boolean) {
  const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { error } = await sc.from("feature_flags").upsert({ key, enabled }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}

test.beforeAll(async () => {
  if (!hasTestCreds() || !hasServiceRole()) return;
  await setFlag("expenses", true); // income lives on the Expenses hub sidebar now
});

test.afterAll(async () => {
  if (!hasTestCreds()) return;
  const c = ownerClient();
  await c.auth.signInWithPassword({ email: TEST_USER.email, password: TEST_USER.password });
  // income_overrides rows cascade on the income delete.
  await c.from("incomes").delete().eq("source", SOURCE);
});

test("income form exposes the variable-income checkbox", async ({ page }) => {
  await uiLogin(page);
  await expect(page).toHaveURL(/\/app(\/|$)/);
  await page.goto("/app/expenses");
  await page.getByRole("button", { name: "Add income" }).click();
  await expect(page.getByLabel("Variable income")).toBeVisible();
});
