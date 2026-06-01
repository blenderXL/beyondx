import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { TEST_USER, hasTestCreds, hasServiceRole, uiLogin } from "./helpers/auth";

test.skip(
  !hasTestCreds() || !hasServiceRole(),
  "Set TEST_USER_* and SUPABASE_SERVICE_ROLE_KEY to run the planner E2E",
);

const stamp = Date.now();
const incomeName = `e2e-plan-income-${stamp}`;
const expenseName = `e2e-plan-exp-${stamp}`;
const debtName = `e2e-plan-debt-${stamp}`;

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
  await c.from("incomes").delete().eq("source", incomeName);
  await c.from("expenses").delete().eq("category", expenseName);
  await c.from("debts").delete().eq("name", debtName);
});

test("monthly planner: flag ON → computed income/offerings/expenses/rollups render", async ({ page }) => {
  await setFlag("planner", true);

  const c = ownerClient();
  const { data: auth } = await c.auth.signInWithPassword({
    email: TEST_USER.email,
    password: TEST_USER.password,
  });
  const profile_id = auth.user!.id;
  // Seed a paycheck with a 10% offering, a utility bill, and a debt minimum.
  await c.from("incomes").insert({
    profile_id,
    source: incomeName,
    amount: 3000,
    cadence: "monthly",
    pay_day: 1,
    tithe_mode: "percent",
    tithe_value: 10,
  });
  await c.from("expenses").insert({
    profile_id,
    category: expenseName,
    amount: 115,
    cadence: "monthly",
    due_day: 5,
    expense_group: "utility",
  });
  await c.from("debts").insert({ profile_id, name: debtName, balance: 1000, apr: 0, min_payment: 200, due_day: 10 });

  await uiLogin(page);
  await expect(page).toHaveURL(/\/app(\/|$)/);
  await page.goto("/app/planner");

  await expect(page.getByRole("heading", { name: "This month" })).toBeVisible();
  // Rollups reflect the computed engine output (robust to any other rows the user has).
  const rollups = page.getByRole("list", { name: "Rollups" });
  await expect(rollups).toContainText("Offerings");
  await expect(rollups).toContainText("Utility");
  await expect(rollups).toContainText("Debt minimums");
  // The 1st-of-month pay cycle column renders (income landed on day 1).
  await expect(page.getByText("1st-of-month")).toBeVisible();
});
