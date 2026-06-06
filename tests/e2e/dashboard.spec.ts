import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { TEST_USER, hasTestCreds, uiLogin } from "./helpers/auth";

test.skip(!hasTestCreds(), "Set TEST_USER_* to run the dashboard E2E");

const expenseName = `e2e-dash-${Date.now()}`;
let expenseId: string | null = null;

function ownerClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

test.afterAll(async () => {
  if (!hasTestCreds()) return;
  const c = ownerClient();
  await c.auth.signInWithPassword({ email: TEST_USER.email, password: TEST_USER.password });
  if (expenseId) await c.from("transactions").delete().eq("expense_id", expenseId);
  await c.from("expenses").delete().eq("category", expenseName);
});

test("dashboard: headline stats render and an agenda item can be paid", async ({ page }) => {
  const c = ownerClient();
  const { data: auth } = await c.auth.signInWithPassword({
    email: TEST_USER.email,
    password: TEST_USER.password,
  });
  // due_day 1 sorts it to the top of the agenda so it lands in the visible slice.
  const { data: inserted, error } = await c
    .from("expenses")
    .insert({
      profile_id: auth.user!.id,
      category: expenseName,
      amount: 12.34,
      cadence: "monthly",
      expense_group: "utilities",
      due_day: 1,
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  expenseId = inserted!.id as string;

  await uiLogin(page);
  await expect(page).toHaveURL(/\/app(\/|$)/);
  await page.goto("/app");

  // Hero + the four headline stat cards.
  await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();
  for (const label of ["Total debt", "Monthly minimums", "Payoff date", "Interest saved"]) {
    await expect(page.getByRole("group", { name: label })).toBeVisible();
  }

  // The seeded expense shows in Today's agenda; paying it removes the row.
  const agenda = page.getByRole("list", { name: "Today's agenda" });
  await expect(agenda).toContainText(expenseName);
  await page.getByRole("button", { name: `Pay ${expenseName}` }).click();
  await expect(page.getByRole("button", { name: `Pay ${expenseName}` })).toHaveCount(0);
});
