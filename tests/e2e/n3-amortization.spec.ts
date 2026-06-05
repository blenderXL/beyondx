import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { TEST_USER, hasTestCreds, hasServiceRole, uiLogin } from "./helpers/auth";

/**
 * N3: the month-by-month amortization table on the Payoff Plan, plus CSV export.
 */
test.skip(!hasTestCreds() || !hasServiceRole(), "Set TEST_USER_* and SUPABASE_SERVICE_ROLE_KEY for N3 E2E");

const debtName = `e2e-n3-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

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
  await setFlag("payoffEngine", true);
  const c = ownerClient();
  const { data: auth } = await c.auth.signInWithPassword({ email: TEST_USER.email, password: TEST_USER.password });
  const { error } = await c
    .from("debts")
    .insert({ profile_id: auth.user!.id, name: debtName, type: "credit_card", balance: 1200, apr: 0, min_payment: 0 });
  if (error) throw new Error(error.message);
});

test.afterAll(async () => {
  if (!hasTestCreds()) return;
  const c = ownerClient();
  await c.auth.signInWithPassword({ email: TEST_USER.email, password: TEST_USER.password });
  await c.from("debts").delete().eq("name", debtName);
});

test("amortization table renders and exports a CSV", async ({ page }) => {
  await uiLogin(page);
  await expect(page).toHaveURL(/\/app(\/|$)/);
  await page.goto("/app/plans");
  await expect(page.getByRole("heading", { name: "Strategy & Projections" })).toBeVisible();

  // A large budget is feasible regardless of the test user's other debts (parallel specs).
  await page.getByLabel("Monthly budget").fill("9999999");

  // The month-by-month table shows, with a column for the seeded debt and ≥1 month row.
  const table = page.getByRole("table", { name: "Month-by-month payoff schedule" });
  await expect(table).toBeVisible();
  await expect(table.getByRole("columnheader", { name: debtName })).toBeVisible();
  await expect(table.locator("tbody tr").first()).toBeVisible();

  // Export CSV triggers a download whose contents have the header + the debt column.
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export CSV" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^payoff-.*\.csv$/);
  const path = await download.path();
  const csv = readFileSync(path, "utf8");
  expect(csv.split("\n")[0]).toContain("Month,");
  expect(csv).toContain(debtName);
});
