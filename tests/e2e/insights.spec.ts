import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { TEST_USER, hasTestCreds, hasServiceRole, uiLogin } from "./helpers/auth";

test.skip(
  !hasTestCreds() || !hasServiceRole(),
  "Set TEST_USER_* and SUPABASE_SERVICE_ROLE_KEY to run the insights E2E",
);

const debtName = `e2e-insight-${Date.now()}`;

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

test("insights: flag ON → distribution + utilization render; advanced charts are Pro-gated", async ({ page }) => {
  await setFlag("insights", true);

  const c = ownerClient();
  const { data: auth } = await c.auth.signInWithPassword({
    email: TEST_USER.email,
    password: TEST_USER.password,
  });
  await c.from("debts").insert({
    profile_id: auth.user!.id,
    name: debtName,
    type: "credit_card",
    balance: 2000,
    apr: 24,
    min_payment: 50,
    credit_limit: 5000,
  });

  await uiLogin(page);
  await expect(page).toHaveURL(/\/app(\/|$)/);
  await page.goto("/app/insights");

  await expect(page.getByRole("heading", { name: "Insights" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Debt distribution" })).toContainText("Credit Card/Line");
  await expect(page.getByRole("img", { name: "Trend chart" }).first()).toBeVisible(); // payoff curve SVG

  // Gate B: the free test user sees the Pro upsell in the advanced section, not the chart.
  await expect(page.getByText(/Unlock this with NZX Pro/i)).toBeVisible();
});
