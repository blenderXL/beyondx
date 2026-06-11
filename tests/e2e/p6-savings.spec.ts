import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { TEST_USER, hasTestCreds, hasServiceRole, uiLogin } from "./helpers/auth";

/**
 * Phase 6 — savings: typed pots, contributions, trajectory. Contributions ride the existing
 * transactions table (no migration needed), so the contribution + trajectory flow runs
 * unconditionally. The pot TYPE needs migration 0012 (savings_goals.type) and auto-skips
 * until that's applied to nzx-dev.
 */
test.skip(!hasTestCreds() || !hasServiceRole(), "Set TEST_USER_* and SUPABASE_SERVICE_ROLE_KEY for P6 E2E");

const PREFIX = `e2e-p6-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const POT = `${PREFIX}-pot`;
const TYPED = `${PREFIX}-roth`;
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
  await setFlag("savings", true);
  const c = ownerClient();
  await c.auth.signInWithPassword({ email: TEST_USER.email, password: TEST_USER.password });
  const probe = await c.from("savings_goals").select("type").limit(1);
  columnReady = !probe.error;
});

test.afterAll(async () => {
  if (!hasTestCreds()) return;
  const c = ownerClient();
  await c.auth.signInWithPassword({ email: TEST_USER.email, password: TEST_USER.password });
  // Contribution transactions cascade on the pot delete (FK on delete cascade).
  await c.from("savings_goals").delete().in("name", [POT, TYPED]);
});

test("add a pot, record a contribution → balance grows and the trajectory renders", async ({ page }) => {
  await uiLogin(page);
  await expect(page).toHaveURL(/\/app(\/|$)/);
  await page.goto("/app/savings");

  // New pot starting at $0 (type defaults to General — no migration dependency).
  await page.getByRole("button", { name: "New pot" }).click();
  await page.getByLabel("Name").fill(POT);
  await page.getByLabel("Current amount").fill("0");
  await page.getByRole("button", { name: "Add pot" }).click();

  const card = page.getByRole("list", { name: "Savings pots" }).locator("li", { hasText: POT });
  await expect(card).toBeVisible();
  await expect(card).toContainText("$0.00");

  // Contribute $250 → the pot balance becomes $250. Click the card to open its detail modal,
  // then record the contribution there (the card→modal convention).
  await card.getByText(POT).click();
  await page.getByLabel("Contribution amount").fill("250");
  await page.getByRole("button", { name: "Record contribution" }).click();

  const updated = page.getByRole("list", { name: "Savings pots" }).locator("li", { hasText: POT });
  await expect(updated).toContainText("$250.00");
  // A contribution exists now, so the trajectory chart renders.
  await expect(page.getByRole("img", { name: "Trend chart" })).toBeVisible();
});

test("a typed pot shows its type chip", async ({ page }) => {
  test.skip(!columnReady, "savings_goals.type (migration 0012) not applied to nzx-dev yet");

  await uiLogin(page);
  await expect(page).toHaveURL(/\/app(\/|$)/);
  await page.goto("/app/savings");

  await page.getByRole("button", { name: "New pot" }).click();
  await page.getByLabel("Name").fill(TYPED);
  await page.getByLabel("Type").selectOption("roth_ira");
  await page.getByRole("button", { name: "Add pot" }).click();

  const card = page.getByRole("list", { name: "Savings pots" }).locator("li", { hasText: TYPED });
  await expect(card).toBeVisible();
  await expect(card).toContainText("Roth IRA");
});

test("the recurring selector reveals a fixed amount or a percent-of-income field", async ({ page }) => {
  await uiLogin(page);
  await expect(page).toHaveURL(/\/app(\/|$)/);
  await page.goto("/app/savings");

  await page.getByRole("button", { name: "New pot" }).click();
  // Off by default — neither recurring field is shown.
  await expect(page.getByLabel("Monthly contribution")).toBeHidden();
  await expect(page.getByLabel("Percent of income")).toBeHidden();

  await page.getByLabel("Recurring contribution").selectOption("fixed");
  await expect(page.getByLabel("Monthly contribution")).toBeVisible();

  await page.getByLabel("Recurring contribution").selectOption("percent");
  await expect(page.getByLabel("Percent of income")).toBeVisible();
  await expect(page.getByLabel("Monthly contribution")).toBeHidden();
});
