import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { TEST_USER, hasTestCreds, hasServiceRole, uiLogin } from "./helpers/auth";

test.skip(
  !hasTestCreds() || !hasServiceRole(),
  "Set TEST_USER_* and SUPABASE_SERVICE_ROLE_KEY to run the payoff E2E",
);

const debtName = `e2e-payoff-${Date.now()}`;

async function setFlag(key: string, enabled: boolean) {
  const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { error } = await sc.from("feature_flags").upsert({ key, enabled }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}

function ownerClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

test.afterAll(async () => {
  if (!hasTestCreds()) return;
  const c = ownerClient();
  await c.auth.signInWithPassword({ email: TEST_USER.email, password: TEST_USER.password });
  await c.from("debts").delete().eq("name", debtName);
});

test("payoff plan: flag ON → seeded debt appears; feasible vs infeasible budgets", async ({ page }) => {
  await setFlag("payoffEngine", true);

  // Seed one interest-free debt. Assertions stay robust to any other debts the test
  // user has (parallel specs) — the exact month math is covered by the unit tests.
  const c = ownerClient();
  const { data: auth } = await c.auth.signInWithPassword({
    email: TEST_USER.email,
    password: TEST_USER.password,
  });
  const profileId = auth.user!.id;
  const { error } = await c.from("debts").insert({
    profile_id: profileId,
    name: debtName,
    balance: 1200,
    apr: 0,
    min_payment: 0,
  });
  expect(error).toBeNull();

  await uiLogin(page);
  await expect(page).toHaveURL(/\/app(\/|$)/);
  await page.goto("/app/plans");
  await expect(page.getByRole("heading", { name: "Payoff plan" })).toBeVisible();

  // The seeded debt appears in the payoff order.
  await expect(page.getByRole("list", { name: "Payoff order" })).toContainText(debtName);

  // A large budget is feasible → no warning, and the debt shows a payoff month.
  await page.getByLabel("Monthly budget").fill("999999");
  await expect(page.getByText(/budget too low/i)).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Payoff order" })).toContainText(/paid off/i);

  // A budget of 0 can't amortize → infeasible warning.
  await page.getByLabel("Monthly budget").fill("0");
  await expect(page.getByText(/budget too low/i)).toBeVisible();
});
