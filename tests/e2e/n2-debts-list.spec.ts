import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { TEST_USER, hasTestCreds, uiLogin } from "./helpers/auth";

/**
 * N2: the Debts list controls — search-as-you-type, type filter, sort, and the card⇄list
 * view toggle (persisted). Seeds two debts via the owner client so assertions can scope to
 * them regardless of any other debts the test user has.
 */
test.skip(!hasTestCreds(), "Set TEST_USER_EMAIL / TEST_USER_PASSWORD to run the N2 debts-list E2E");

const PREFIX = `e2e-n2-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const AAA = `${PREFIX}-aaa`; // credit_card, small balance
const ZZZ = `${PREFIX}-zzz`; // mortgage, large balance

function ownerClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

test.beforeAll(async () => {
  if (!hasTestCreds()) return;
  const c = ownerClient();
  const { data: auth } = await c.auth.signInWithPassword({ email: TEST_USER.email, password: TEST_USER.password });
  const profileId = auth.user!.id;
  const { error } = await c.from("debts").insert([
    { profile_id: profileId, name: AAA, type: "credit_card", balance: 100, apr: 25, min_payment: 10 },
    { profile_id: profileId, name: ZZZ, type: "mortgage", balance: 999999, apr: 3, min_payment: 2000 },
  ]);
  if (error) throw new Error(error.message);
});

test.afterAll(async () => {
  if (!hasTestCreds()) return;
  const c = ownerClient();
  await c.auth.signInWithPassword({ email: TEST_USER.email, password: TEST_USER.password });
  await c.from("debts").delete().in("name", [AAA, ZZZ]);
});

test("search, type filter, sort, and view toggle (persisted)", async ({ page }) => {
  await uiLogin(page);
  await expect(page).toHaveURL(/\/app(\/|$)/);
  await page.goto("/app/debts");
  const list = page.getByRole("list", { name: "Debts" });
  await expect(list.locator("li", { hasText: AAA })).toBeVisible();

  // Search-as-you-type isolates one debt.
  await page.getByLabel("Search debts").fill(AAA);
  await expect(list.locator("li", { hasText: AAA })).toBeVisible();
  await expect(list.locator("li", { hasText: ZZZ })).toHaveCount(0);
  await page.getByLabel("Search debts").fill("");

  // Type filter: Mortgage hides the credit-card debt.
  await page.getByLabel("Filter by type").selectOption({ label: "Mortgage" });
  await expect(list.locator("li", { hasText: ZZZ })).toBeVisible();
  await expect(list.locator("li", { hasText: AAA })).toHaveCount(0);
  await page.getByLabel("Filter by type").selectOption("all");

  // Sort by name A→Z → AAA comes before ZZZ.
  await page.getByLabel("Sort debts").selectOption("name_asc");
  const namesAsc = await list.locator("li").filter({ hasText: PREFIX }).allInnerTexts();
  expect(namesAsc.findIndex((t) => t.includes(AAA))).toBeLessThan(namesAsc.findIndex((t) => t.includes(ZZZ)));

  // Switch to list view → the row-only "Bal" stat label appears; persists across reload.
  await page.getByLabel("List view").click();
  await expect(list.getByText("Bal", { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("List view")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("list", { name: "Debts" }).getByText("Bal", { exact: true }).first()).toBeVisible();
});
