import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { TEST_USER, hasTestCreds, hasServiceRole, uiLogin } from "./helpers/auth";

/**
 * Phase 3 — Expenses: the redesigned form (debt-pick prefill), the offerings-as-expense
 * group, income tithe removal, and the rail. The offering-percent path needs migration 0009
 * (expenses.pct_of_income); it auto-skips until that's applied to nzx-dev. Everything else
 * (form redesign, tithe removal, rail/subscriptions) works without the column.
 */
test.skip(!hasTestCreds() || !hasServiceRole(), "Set TEST_USER_* and SUPABASE_SERVICE_ROLE_KEY for P3 E2E");

const PREFIX = `e2e-p3-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const DEBT = `${PREFIX}-debt`;
const SUB = `${PREFIX}-netflix`;
const OFFERING = `${PREFIX}-offering`;
let columnReady = false;

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
  await setFlag("expenses", true);
  await setFlag("income", true);
  const c = ownerClient();
  const { data: auth } = await c.auth.signInWithPassword({ email: TEST_USER.email, password: TEST_USER.password });
  const profileId = auth.user!.id;
  await c.from("debts").insert({ profile_id: profileId, name: DEBT, type: "credit_card", balance: 800, apr: 22, min_payment: 75 });
  await c.from("expenses").insert({ profile_id: profileId, category: SUB, amount: 15.99, cadence: "monthly", expense_group: "subscription" });
  const probe = await c.from("expenses").select("pct_of_income").limit(1);
  columnReady = !probe.error;
});

test.afterAll(async () => {
  if (!hasTestCreds()) return;
  const c = ownerClient();
  await c.auth.signInWithPassword({ email: TEST_USER.email, password: TEST_USER.password });
  await c.from("expenses").delete().in("category", [SUB, OFFERING]);
  await c.from("debts").delete().eq("name", DEBT);
});

test("redesigned form prefills from a debt; tithe is gone from income; rail renders", async ({ page }) => {
  await uiLogin(page);
  await expect(page).toHaveURL(/\/app(\/|$)/);

  // Expenses form: the first choice is debt-vs-other; picking a debt prefills name + amount.
  await page.goto("/app/expenses");
  await page.getByRole("button", { name: "New expense" }).click();
  // The editor opens in a modal; scope field queries to it (the list + filters stay mounted behind).
  const form = page.getByRole("dialog", { name: "New expense" });
  await expect(form.getByRole("button", { name: "Pay toward a debt" })).toBeVisible();
  await form.getByRole("button", { name: "Pay toward a debt" }).click();
  await form.getByLabel("Which debt").selectOption({ label: DEBT });
  await expect(form.getByLabel("Name")).toHaveValue(DEBT);
  await expect(form.getByLabel("Amount")).toHaveValue("75");
  await form.getByRole("button", { name: "Cancel" }).click();

  // The rail summarizes spending + subscriptions (the seeded Netflix sub counts).
  const rail = page.getByRole("complementary", { name: "Where your money goes" });
  await expect(rail).toContainText(/money going toward/i);
  await expect(rail).toContainText(/active subscription/i);

  // Income is managed on the Expenses hub now (Phase 5C) and the form has no tithe field.
  await page.getByRole("button", { name: "Add income" }).click();
  await expect(page.getByText("Offering / tithe")).toHaveCount(0);
  await expect(page.getByLabel("Source")).toBeVisible();
});

test("offering expense: percent-of-income, shown once", async ({ page }) => {
  test.skip(!columnReady, "expenses.pct_of_income (migration 0009) not applied to nzx-dev yet");

  await uiLogin(page);
  await expect(page).toHaveURL(/\/app(\/|$)/);
  await page.goto("/app/expenses");
  await page.getByRole("button", { name: "New expense" }).click();
  const form = page.getByRole("dialog", { name: "New expense" });
  await form.getByLabel("Name").fill(OFFERING);
  await form.getByLabel("Group").selectOption("offering");
  // The offering %/$ toggle defaults to percent; enter 10%.
  await form.getByLabel("Offering percent of income").fill("10");
  await form.getByRole("button", { name: "Add expense" }).click();

  const tile = page.getByRole("list", { name: "Expenses" }).locator("li", { hasText: OFFERING });
  await expect(tile).toBeVisible();
  await expect(tile).toContainText("10% of income");
});
