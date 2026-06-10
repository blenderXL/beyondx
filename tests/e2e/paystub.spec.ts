import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { TEST_USER, hasTestCreds, hasServiceRole, uiLogin, expectOnApp } from "./helpers/auth";

// Paycheck calculator. The estimate is pure client-side math (always testable with creds);
// the persistence case needs migration 0018 and auto-skips until it's applied to nzx-dev.
test.skip(!hasTestCreds(), "Set TEST_USER_* to run the paystub E2E");

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}
async function tableExists(): Promise<boolean> {
  if (!hasServiceRole()) return false;
  const { error } = await serviceClient().from("paystub_inputs").select("profile_id").limit(1);
  return !error;
}

test("paycheck calculator computes take-home live", async ({ page }) => {
  await uiLogin(page);
  await expectOnApp(page);
  await page.goto("/app/paystub");

  await expect(page.getByRole("heading", { name: "Estimate your take-home" })).toBeVisible();
  await expect(page.getByText(/Estimate only/i)).toBeVisible();

  await page.getByLabel("Annual salary").fill("60000");
  await page.getByLabel("Pay frequency").selectOption("biweekly");
  await page.getByLabel("Filing status").selectOption("single");
  await page.getByLabel("State").selectOption("TX");
  await page.getByLabel("401(k) percent").fill("0");

  // $60k, single, biweekly, no state tax → $1,932.63 take-home per paycheck;
  // federal annual = $5,161.50. (Deterministic from the bundled 2025 tables.)
  await expect(page.getByText("$1,932.63").first()).toBeVisible();
  await expect(page.getByText("$5,161.50").first()).toBeVisible();

  // Switch to a taxed state → take-home drops (state tax applies).
  await page.getByLabel("State").selectOption("CA");
  await expect(page.getByText("$1,794.17").first()).toBeVisible();
});

test("inputs persist across a reload (needs migration 0018)", async ({ page }) => {
  test.skip(!(await tableExists()), "paystub_inputs (migration 0018) not applied to nzx-dev yet");

  await uiLogin(page);
  await expectOnApp(page);
  await page.goto("/app/paystub");

  await page.getByLabel("Annual salary").fill("123456");
  await page.getByLabel("State").selectOption("NY");
  await page.waitForTimeout(1200); // debounced save is 800ms
  await page.reload();

  await expect(page.getByLabel("Annual salary")).toHaveValue("123456");
  await expect(page.getByLabel("State")).toHaveValue("NY");

  // cleanup — drop the saved row for the shared test user.
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data } = await anon.auth.signInWithPassword({ email: TEST_USER.email, password: TEST_USER.password });
  if (data.user) await serviceClient().from("paystub_inputs").delete().eq("profile_id", data.user.id);
});
