import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { TEST_USER, hasTestCreds, uiLogin } from "./helpers/auth";

/**
 * Phase 2 — Debts page: category view, reverse sorts, type-dynamic card metric, and the
 * category rail. Seeds two debts of different buckets so assertions scope to them.
 */
test.skip(!hasTestCreds(), "Set TEST_USER_EMAIL / TEST_USER_PASSWORD for the P2 debts E2E");

const PREFIX = `e2e-p2-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const CARD = `${PREFIX}-card`; // credit_card, has a limit → Util
const HOME = `${PREFIX}-home`; // mortgage → % paid

function ownerClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

test.beforeAll(async () => {
  if (!hasTestCreds()) return;
  const c = ownerClient();
  const { data: auth } = await c.auth.signInWithPassword({ email: TEST_USER.email, password: TEST_USER.password });
  const profileId = auth.user!.id;
  const { error } = await c.from("debts").insert([
    { profile_id: profileId, name: CARD, type: "credit_card", balance: 500, apr: 22, min_payment: 25, credit_limit: 1000 },
    { profile_id: profileId, name: HOME, type: "mortgage", balance: 200000, apr: 3, min_payment: 1500 },
  ]);
  if (error) throw new Error(error.message);
});

test.afterAll(async () => {
  if (!hasTestCreds()) return;
  const c = ownerClient();
  await c.auth.signInWithPassword({ email: TEST_USER.email, password: TEST_USER.password });
  await c.from("debts").delete().in("name", [CARD, HOME]);
});

test("category view, reverse sort, dynamic metrics, category rail", async ({ page }) => {
  await uiLogin(page);
  await expect(page).toHaveURL(/\/app(\/|$)/);
  await page.goto("/app/debts");
  await expect(page.getByRole("heading", { name: "Your debts" })).toBeVisible();

  // The category rail shows a per-bucket breakdown (Credit cards + Mortgage & home present).
  const rail = page.getByRole("complementary", { name: "Debt by category" });
  await expect(rail).toContainText("Credit cards");
  await expect(rail).toContainText("Mortgage & home");

  // Type-dynamic card metric: the credit card shows "Util", the mortgage shows "Paid".
  const cardTile = page.getByRole("listitem").filter({ hasText: CARD }).first();
  await expect(cardTile).toContainText("Util");
  const homeTile = page.getByRole("listitem").filter({ hasText: HOME }).first();
  await expect(homeTile).toContainText("Paid");

  // Reverse sort: balance low→high puts the credit card ($500) before the mortgage ($200k).
  await page.getByLabel("Sort debts").selectOption("balance_asc");
  const tiles = page.getByRole("list", { name: "Debts" }).getByRole("listitem");
  const texts = await tiles.filter({ hasText: PREFIX }).allInnerTexts();
  expect(texts.findIndex((t) => t.includes(CARD))).toBeLessThan(texts.findIndex((t) => t.includes(HOME)));

  // Category view groups the cards under bucket sections.
  await page.getByLabel("Category view").click();
  await expect(page.getByRole("region", { name: "Credit cards" }).getByText(CARD)).toBeVisible();
  await expect(page.getByRole("region", { name: "Mortgage & home" }).getByText(HOME)).toBeVisible();
});
