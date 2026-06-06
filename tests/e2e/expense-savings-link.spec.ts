import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { TEST_USER, hasTestCreds, uiLogin } from "./helpers/auth";

test.skip(!hasTestCreds(), "Set TEST_USER_* to run the expense→savings link E2E");

const goalName = `e2e-sav-goal-${Date.now()}`;
const expName = `e2e-sav-exp-${Date.now()}`;
let profileId = "";
let goalId = "";
let columnReady = false;

function ownerClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

test.beforeAll(async () => {
  if (!hasTestCreds()) return;
  const c = ownerClient();
  const { data: auth } = await c.auth.signInWithPassword({ email: TEST_USER.email, password: TEST_USER.password });
  profileId = auth.user!.id;
  const { data } = await c
    .from("savings_goals")
    .insert({ profile_id: profileId, name: goalName, current_amount: 0 })
    .select("id")
    .single();
  goalId = data!.id as string;
  // The savings_goal_id column lands with migration 0017 (deploy-dev on merge); gate the
  // contribute flow until then.
  const probe = await c.from("expenses").select("savings_goal_id").limit(1);
  columnReady = !probe.error;
});

test.afterAll(async () => {
  if (!hasTestCreds()) return;
  const c = ownerClient();
  await c.auth.signInWithPassword({ email: TEST_USER.email, password: TEST_USER.password });
  await c.from("expenses").delete().eq("category", expName);
  await c.from("savings_goals").delete().eq("id", goalId);
});

test("the expense form offers 'Pay toward savings' with the user's goals", async ({ page }) => {
  await uiLogin(page);
  await expect(page).toHaveURL(/\/app(\/|$)/);
  await page.goto("/app/expenses");
  await page.getByRole("button", { name: "New expense" }).click();
  const form = page.getByRole("dialog", { name: "New expense" });
  await form.getByRole("button", { name: "Pay toward savings" }).click();
  await expect(form.getByLabel("Which savings goal")).toContainText(goalName);
});

test("paying a savings-linked expense contributes to the goal; revert undoes it", async ({ page }) => {
  test.skip(!columnReady, "expenses.savings_goal_id (migration 0017) not applied to nzx-dev yet");
  const c = ownerClient();
  const goalAmount = async () => {
    const { data } = await c.from("savings_goals").select("current_amount").eq("id", goalId).maybeSingle();
    return data ? Number((data as { current_amount: number }).current_amount) : null;
  };
  expect(await goalAmount()).toBe(0);

  await uiLogin(page);
  await expect(page).toHaveURL(/\/app(\/|$)/);
  await page.goto("/app/expenses");

  // Create an expense that pays toward the goal.
  await page.getByRole("button", { name: "New expense" }).click();
  const form = page.getByRole("dialog", { name: "New expense" });
  await form.getByRole("button", { name: "Pay toward savings" }).click();
  await form.getByLabel("Which savings goal").selectOption({ label: goalName });
  await form.getByLabel("Name", { exact: true }).fill(expName);
  await form.getByLabel("Amount", { exact: true }).fill("50");
  await form.getByRole("button", { name: "Add expense" }).click();

  await page.getByLabel("Search expenses").fill(expName);
  // Pay it → the pot grows by $50.
  await page.getByRole("button", { name: `Pay ${expName}` }).click();
  await expect.poll(goalAmount).toBe(50);

  // Revert → back to $0.
  await page.getByRole("button", { name: `Revert ${expName}` }).click();
  await expect.poll(goalAmount).toBe(0);
});
