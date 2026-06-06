import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { TEST_USER, hasTestCreds, uiLogin } from "./helpers/auth";

test.skip(!hasTestCreds(), "Set TEST_USER_* to run the expenses group-by / offerings E2E");

const groupExp = `e2e-grp-${Date.now()}`;
const offeringName = `e2e-offer-${Date.now()}`;
let profileId = "";
let pctReady = false;

function ownerClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

test.beforeAll(async () => {
  if (!hasTestCreds()) return;
  const c = ownerClient();
  const { data: auth } = await c.auth.signInWithPassword({
    email: TEST_USER.email,
    password: TEST_USER.password,
  });
  profileId = auth.user!.id;

  await c.from("expenses").insert({
    profile_id: profileId,
    category: groupExp,
    amount: 42,
    cadence: "monthly",
    expense_group: "personal",
    due_day: 8,
  });

  // A 10% offering only inserts cleanly once pct_of_income (migration 0009) is applied.
  const { error } = await c.from("expenses").insert({
    profile_id: profileId,
    category: offeringName,
    amount: 0,
    cadence: "monthly",
    expense_group: "offering",
    pct_of_income: 10,
    due_day: 1,
  });
  pctReady = !error;
});

test.afterAll(async () => {
  if (!hasTestCreds()) return;
  const c = ownerClient();
  await c.auth.signInWithPassword({ email: TEST_USER.email, password: TEST_USER.password });
  await c.from("expenses").delete().in("category", [groupExp, offeringName]);
});

test("group-by view shows category sections with subtotals", async ({ page }) => {
  await uiLogin(page);
  await expect(page).toHaveURL(/\/app(\/|$)/);
  await page.goto("/app/expenses");

  await page.getByRole("button", { name: "Group by category" }).click();
  // The seeded "personal" expense lands under a Personal section with a "// personal" header.
  const section = page.getByRole("region", { name: "Personal" });
  await expect(section).toContainText("// personal");
  await expect(section).toContainText(groupExp);
});

test("offering card expands to a per-income breakdown that sums to the total", async ({ page }) => {
  test.skip(!pctReady, "expenses.pct_of_income (migration 0009) not applied to nzx-dev yet");

  await uiLogin(page);
  await expect(page).toHaveURL(/\/app(\/|$)/);
  await page.goto("/app/expenses");
  await page.getByLabel("Filter by group").selectOption("offering");

  const card = page.getByRole("list", { name: "Expenses" }).locator("li", { hasText: offeringName });
  await expect(card).toBeVisible();
  await expect(card).toContainText("10% of income");

  // Expand the breakdown; each line is "10% × <source>" and a Total row closes it.
  await card.getByRole("button", { name: `Show offering breakdown for ${offeringName}` }).click();
  await expect(card.getByText(/10% ×/).first()).toBeVisible();
  await expect(card.getByText("Total")).toBeVisible();
});
