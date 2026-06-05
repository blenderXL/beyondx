import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { TEST_USER, hasTestCreds, hasServiceRole, uiLogin } from "./helpers/auth";

/**
 * N1 quick-polish coverage:
 *  - sidebar shows "Debt payoff planner" and omits the retired items,
 *  - the payoff planner page remembers method + budget across a reload (localStorage),
 *  - the debt Interest-rate field accepts a value typed with a "%" sign.
 *
 * Needs the test user (UI login) and the service role (to flip the release flags the
 * Budget / Payoff Plan nav items gate on). Skips cleanly when either is absent.
 */
test.skip(
  !hasTestCreds() || !hasServiceRole(),
  "Set TEST_USER_* and SUPABASE_SERVICE_ROLE_KEY to run the N1 polish E2E",
);

const createdNames: string[] = [];

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
  // The Payoff Plan (payoffEngine) nav item only renders when its flag is on.
  await setFlag("payoffEngine", true);
});

test.afterAll(async () => {
  if (!hasTestCreds() || createdNames.length === 0) return;
  const c = ownerClient();
  await c.auth.signInWithPassword({ email: TEST_USER.email, password: TEST_USER.password });
  await c.from("debts").delete().in("name", createdNames);
});

test("sidebar shows Debt payoff planner and omits retired Income + Budget + Insights", async ({ page }) => {
  await uiLogin(page);
  await expect(page).toHaveURL(/\/app(\/|$)/);
  const nav = page.getByRole("navigation", { name: "App" });
  // Payoff Plan was renamed to "Debt payoff planner" and moved under Debts.
  await expect(nav.getByRole("link", { name: "Debt payoff planner" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Payoff Plan", exact: true })).toHaveCount(0);
  // Insights was merged into the payoff planner; its nav item is gone.
  await expect(nav.getByRole("link", { name: "Insights", exact: true })).toHaveCount(0);
  // Income + Budget were folded into Expenses (Phase 5C); the old labels are gone.
  await expect(nav.getByRole("link", { name: "Income", exact: true })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Budget", exact: true })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Planner", exact: true })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Plans", exact: true })).toHaveCount(0);
});

test("Payoff Plan remembers method + budget across a reload", async ({ page }) => {
  await uiLogin(page);
  await expect(page).toHaveURL(/\/app(\/|$)/);
  await page.goto("/app/plans");
  await expect(page.getByRole("heading", { name: "Strategy & Projections" })).toBeVisible();

  await page.getByLabel("Method").selectOption("snowball");
  await page.getByLabel("Monthly budget").fill("4242");

  await page.reload();
  await expect(page.getByRole("heading", { name: "Strategy & Projections" })).toBeVisible();
  await expect(page.getByLabel("Method")).toHaveValue("snowball");
  await expect(page.getByLabel("Monthly budget")).toHaveValue("4242");
});

test("Interest-rate field accepts a value typed with a percent sign", async ({ page }) => {
  await uiLogin(page);
  await expect(page).toHaveURL(/\/app(\/|$)/);
  await page.goto("/app/debts");
  await expect(page.getByRole("heading", { name: "Your debts" })).toBeVisible();

  const name = `e2e-pct-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  createdNames.push(name);

  await page.getByRole("button", { name: "New debt" }).click();
  await page.getByLabel("Debt nickname / description").fill(name);
  // Medical is exempt from the required Next Due Date — keeps the form minimal.
  await page.getByRole("button", { name: "Type of debt" }).click();
  await page.getByRole("option", { name: "Medical Bill" }).click();
  await page.getByLabel("Current balance").fill("1000");
  await page.getByLabel("Minimum payment").fill("25");
  await page.getByLabel("Interest rate (%)", { exact: true }).fill("24.99%");
  await page.getByRole("button", { name: "Add debt" }).click();

  // No validation error, and the debt lands in the list.
  await expect(page.getByText(/must be a number/i)).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Debts" }).locator("li", { hasText: name })).toBeVisible();
});
