import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { TEST_USER, hasTestCreds, hasServiceRole, uiLogin, expectOnApp } from "./helpers/auth";

// Phase 5C-2a: income sources are managed directly on the Expenses hub (the embedded income
// manager) — add a source here and it shows up, ahead of removing the standalone Income page.
test.skip(
  !hasTestCreds() || !hasServiceRole(),
  "Set TEST_USER_* and SUPABASE_SERVICE_ROLE_KEY to run the Phase-5C-2a income-on-hub E2E",
);

const stamp = Date.now();
const sourceName = `e2e-p5c2a-income-${stamp}`;

function ownerClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
async function setFlag(key: string, enabled: boolean) {
  const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { error } = await sc.from("feature_flags").upsert({ key, enabled }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}

test.afterAll(async () => {
  if (!hasTestCreds()) return;
  const c = ownerClient();
  await c.auth.signInWithPassword({ email: TEST_USER.email, password: TEST_USER.password });
  await c.from("incomes").delete().eq("source", sourceName);
});

test("add an income source from the Expenses hub", async ({ page }) => {
  await setFlag("expenses", true);
  await uiLogin(page);
  await expectOnApp(page);
  await page.goto("/app/expenses");

  // The income manager lives on the hub now.
  await page.getByRole("button", { name: "Add income" }).click();
  await page.getByLabel("Source").fill(sourceName);
  await page.getByLabel("Amount", { exact: true }).fill("4321");
  await page.getByRole("button", { name: "Add income" }).click(); // form submit

  await expect(page.getByRole("list", { name: "Income" }).getByText(sourceName)).toBeVisible();
});
