import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { TEST_USER, hasTestCreds, hasServiceRole, uiLogin, expectOnApp } from "./helpers/auth";

// Phase 5A: the Expenses page gains search / group-filter / sort, inline amount + pay-day
// editing on the card, and moves the tracked/total stats into the right rail.
test.skip(
  !hasTestCreds() || !hasServiceRole(),
  "Set TEST_USER_* and SUPABASE_SERVICE_ROLE_KEY to run the Phase-5A expenses-UX E2E",
);
test.describe.configure({ mode: "serial" });

const stamp = Date.now();
const expA = `e2e-p5a-A-${stamp}`; // utility, 111
const expB = `e2e-p5a-B-${stamp}`; // subscription, 222

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

test.beforeAll(async () => {
  if (!hasTestCreds()) return;
  const { c, profile_id } = await signedInOwner();
  await c.from("expenses").insert([
    { profile_id, category: expA, amount: 111, cadence: "monthly", expense_group: "utility", due_day: 3, payee: "Acme" },
    { profile_id, category: expB, amount: 222, cadence: "monthly", expense_group: "subscription", due_day: 9 },
  ]);
});
test.afterAll(async () => {
  if (!hasTestCreds()) return;
  const { c } = await signedInOwner();
  await c.from("expenses").delete().eq("category", expA);
  await c.from("expenses").delete().eq("category", expB);
});

test("search narrows the list to matching expenses", async ({ page }) => {
  await setFlag("expenses", true);
  await uiLogin(page);
  await expectOnApp(page);
  await page.goto("/app/expenses");

  await page.getByLabel("Search expenses").fill(expA);
  await expect(page.getByRole("listitem").filter({ hasText: expA })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: expB })).toHaveCount(0);
});

test("group filter shows only the chosen group", async ({ page }) => {
  await setFlag("expenses", true);
  await uiLogin(page);
  await expectOnApp(page);
  await page.goto("/app/expenses");

  await page.getByLabel("Filter by group").selectOption("subscription");
  await expect(page.getByRole("listitem").filter({ hasText: expB })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: expA })).toHaveCount(0);
});

test("the tracked + listed-total stats live in the right rail", async ({ page }) => {
  await setFlag("expenses", true);
  await uiLogin(page);
  await expectOnApp(page);
  await page.goto("/app/expenses");

  const rail = page.getByRole("complementary", { name: "Where your money goes" });
  await expect(rail.getByText("Expenses tracked")).toBeVisible();
  await expect(rail.getByText("Listed total")).toBeVisible();
});

test("inline edit: change an amount on the card and save it", async ({ page }) => {
  await setFlag("expenses", true);
  const { c } = await signedInOwner();
  const amountOf = async () => {
    const { data } = await c.from("expenses").select("amount").eq("category", expA).maybeSingle();
    return data ? Number((data as { amount: number }).amount) : null;
  };
  expect(await amountOf()).toBe(111);

  await uiLogin(page);
  await expectOnApp(page);
  await page.goto("/app/expenses");
  await page.getByLabel("Search expenses").fill(expA); // isolate the card

  const amount = page.getByLabel(`Amount for ${expA}`);
  await expect(amount).toHaveValue("111");
  await amount.fill("150");
  await page.getByRole("listitem").filter({ hasText: expA }).getByRole("button", { name: "Save" }).click();

  await expect.poll(amountOf).toBe(150); // persisted to the row
});
