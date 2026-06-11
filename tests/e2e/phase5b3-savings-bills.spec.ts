import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { TEST_USER, hasTestCreds, hasServiceRole, uiLogin, expectOnApp } from "./helpers/auth";

// Phase 5B-3: savings pots with a recurring monthly contribution auto-appear on the Expenses
// page as checkable bills; checking one off records a contribution and bumps the pot total.
test.skip(
  !hasTestCreds() || !hasServiceRole(),
  "Set TEST_USER_* and SUPABASE_SERVICE_ROLE_KEY to run the Phase-5B-3 savings-bills E2E",
);
test.describe.configure({ mode: "serial" });

const stamp = Date.now();
const potName = `e2e-p5b3-pot-${stamp}`;

function ownerClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
async function setFlag(key: string, enabled: boolean) {
  const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { error } = await sc.from("feature_flags").upsert({ key, enabled }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}
async function signedInOwner() {
  const c = ownerClient();
  const { data } = await c.auth.signInWithPassword({ email: TEST_USER.email, password: TEST_USER.password });
  return { c, profile_id: data.user!.id };
}

let columnReady = false;
let goalId = "";

test.beforeAll(async () => {
  if (!hasTestCreds()) return;
  const { c, profile_id } = await signedInOwner();
  // The monthly_contribution column lands with migration 0015 (deploy-dev on merge).
  columnReady = !(await c.from("savings_goals").select("monthly_contribution").limit(1)).error;
  if (!columnReady) return;
  const { data } = await c
    .from("savings_goals")
    .insert({ profile_id, name: potName, current_amount: 0, type: "emergency", monthly_contribution: 100 })
    .select("id")
    .single();
  goalId = data!.id;
});

test.afterAll(async () => {
  if (!hasTestCreds()) return;
  const { c } = await signedInOwner();
  await c.from("savings_goals").delete().eq("name", potName); // contributions cascade
});

test("the savings form exposes a Monthly contribution field", async ({ page }) => {
  await setFlag("savings", true);
  await uiLogin(page);
  await expectOnApp(page);
  await page.goto("/app/savings");
  await page.getByRole("button", { name: "New pot" }).click();
  // The recurring contribution is now a fixed-amount-or-percent selector; choosing "Fixed amount"
  // reveals the monthly-contribution field.
  await page.getByLabel("Recurring contribution").selectOption("fixed");
  await expect(page.getByLabel("Monthly contribution")).toBeVisible();
});

test("a pot with a monthly contribution shows as a bill; checking it off adds to the pot", async ({ page }) => {
  test.skip(!columnReady, "savings_goals.monthly_contribution not migrated yet (0015)");
  await setFlag("expenses", true);

  const { c } = await signedInOwner();
  const potAmount = async () => {
    const { data } = await c.from("savings_goals").select("current_amount").eq("id", goalId).maybeSingle();
    return Number((data as { current_amount: number }).current_amount);
  };
  expect(await potAmount()).toBe(0);

  await uiLogin(page);
  await expectOnApp(page);
  await page.goto("/app/expenses");

  const savings = page.getByRole("list", { name: "Savings contributions" });
  await expect(savings.getByRole("listitem").filter({ hasText: potName })).toBeVisible();

  const box = page.getByRole("checkbox", { name: `Mark ${potName} contributed` });
  await box.scrollIntoViewIfNeeded();
  await box.check();
  await expect.poll(potAmount).toBe(100); // contribution added to the pot

  await box.uncheck();
  await expect.poll(potAmount).toBe(0); // reversed
});
