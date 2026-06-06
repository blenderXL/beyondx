import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { TEST_USER, hasTestCreds, uiLogin } from "./helpers/auth";

/**
 * Phase 5 — debt enhancements. The suggested-minimum hint is pure client UI (no DB
 * dependency). The starting-balance + loan-date toggle writes `start_date`, which needs
 * migration 0011; that test auto-skips until the column is applied to nzx-dev.
 */
test.skip(!hasTestCreds(), "Set TEST_USER_EMAIL / TEST_USER_PASSWORD to run P5 E2E");

const createdNames: string[] = [];
function uniqueName(prefix: string): string {
  const name = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  createdNames.push(name);
  return name;
}
function anonClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
async function selectDebtType(page: Page, optionLabel: string) {
  await page.getByRole("button", { name: "Type of debt" }).click();
  await page.getByRole("listbox", { name: "Type of debt" }).getByRole("option", { name: optionLabel }).click();
}

let columnReady = false;
test.beforeAll(async () => {
  if (!hasTestCreds()) return;
  const c = anonClient();
  await c.auth.signInWithPassword({ email: TEST_USER.email, password: TEST_USER.password });
  const probe = await c.from("debts").select("start_date").limit(1);
  columnReady = !probe.error;
});

test.afterAll(async () => {
  if (!hasTestCreds() || createdNames.length === 0) return;
  const c = anonClient();
  await c.auth.signInWithPassword({ email: TEST_USER.email, password: TEST_USER.password });
  await c.from("debts").delete().in("name", createdNames);
});

test("credit-card minimum: 'use suggested' fills the empty field, never overwrites a typed value", async ({ page }) => {
  await uiLogin(page);
  await expect(page).toHaveURL(/\/app(\/|$)/);
  await page.goto("/app/debts");

  await page.getByRole("button", { name: "New debt" }).click();
  // Credit card is the default type. $5,000 @ 24% → 1%·5000 ($50) + interest ($100) = $150.
  await page.getByLabel("Current balance").fill("5000");
  await page.getByLabel("Interest rate (%)", { exact: true }).fill("24");
  // Focus the minimum field to blur the APR input (commits the derived suggestion).
  await page.getByLabel("Minimum payment").click();

  const useSuggested = page.getByRole("button", { name: "use suggested" });
  await expect(useSuggested).toBeVisible();
  await useSuggested.click();
  await expect(page.getByLabel("Minimum payment")).toHaveValue("$150.00");

  // Typed value is preserved — clicking again must not overwrite it.
  await page.getByLabel("Minimum payment").fill("$99.00");
  await useSuggested.click();
  await expect(page.getByLabel("Minimum payment")).toHaveValue("$99.00");
});

test("installment debt: starting balance + loan date persist", async ({ page }) => {
  test.skip(!columnReady, "debts.start_date (migration 0011) not applied to nzx-dev yet");

  await uiLogin(page);
  await expect(page).toHaveURL(/\/app(\/|$)/);
  await page.goto("/app/debts");

  const name = uniqueName("e2e-p5-auto");
  await page.getByRole("button", { name: "New debt" }).click();
  await page.getByLabel("Debt nickname / description").fill(name);
  await selectDebtType(page, "Auto/Trailer/Vehicle Loan (secured)");
  await page.getByLabel("Current balance").fill("20000");
  await page.getByLabel("Interest rate (%)", { exact: true }).fill("6");
  await page.getByLabel("Minimum payment").fill("400");
  await page.getByLabel("Next due date").fill("2026-07-01");

  // Reveal + fill the optional starting balance and loan date. Exact labels — "Starting
  // balance" is a substring of the toggle's own label, so an inexact match is ambiguous.
  await page.getByLabel("Set starting balance and loan date").check();
  await page.getByLabel("Starting balance", { exact: true }).fill("25000");
  await page.getByLabel("Loan start date", { exact: true }).fill("2024-01-15");
  await page.getByRole("button", { name: "Add debt" }).click();

  const card = page.getByRole("list", { name: "Debts" }).locator("li", { hasText: name });
  await expect(card).toBeVisible();

  // Re-open the editor (now the card's detail modal): the toggle defaults on and both fields prefill.
  await page.getByRole("button", { name: `Open ${name}` }).dispatchEvent("click");
  const dialog = page.getByRole("dialog", { name: "Debt details" });
  await expect(dialog.getByLabel("Loan start date", { exact: true })).toHaveValue("2024-01-15");
  await expect(dialog.getByLabel("Starting balance", { exact: true })).toHaveValue("$25,000.00");
});
