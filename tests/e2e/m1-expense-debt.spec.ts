import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { TEST_USER, hasTestCreds, hasServiceRole, uiLogin } from "./helpers/auth";

/**
 * M1 coverage: expense-group expansion + "Pay day" copy + promo gate + field info-icons +
 * the Debt-card "Due" fix, plus the expense⇄debt payment bridge. The bridge tests require
 * the `expenses.debt_id` column (migration 0008); they auto-skip until it's applied to
 * nzx-dev (deploy-dev runs it on merge), so PR CI stays green pre-migration.
 */
test.skip(!hasTestCreds() || !hasServiceRole(), "Set TEST_USER_* and SUPABASE_SERVICE_ROLE_KEY for M1 E2E");

const createdDebts: string[] = [];
const createdExpenses: string[] = [];
let bridgeReady = false;

function ownerClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
async function setFlag(key: string, enabled: boolean) {
  const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { error } = await sc.from("feature_flags").upsert({ key, enabled }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}

async function selectDebtType(page: Page, optionLabel: string) {
  await page.getByRole("button", { name: "Type of debt" }).click();
  await page.getByRole("option", { name: optionLabel }).click();
}

test.beforeAll(async () => {
  if (!hasTestCreds() || !hasServiceRole()) return;
  await setFlag("expenses", true);
  await setFlag("planner", true);
  await setFlag("payoffEngine", true);
  // Probe whether migration 0008 (expenses.debt_id) is live yet.
  const c = ownerClient();
  await c.auth.signInWithPassword({ email: TEST_USER.email, password: TEST_USER.password });
  const { error } = await c.from("expenses").select("debt_id").limit(1);
  bridgeReady = !error;
});

test.afterAll(async () => {
  if (!hasTestCreds()) return;
  const c = ownerClient();
  await c.auth.signInWithPassword({ email: TEST_USER.email, password: TEST_USER.password });
  if (createdExpenses.length) await c.from("expenses").delete().in("category", createdExpenses);
  if (createdDebts.length) await c.from("debts").delete().in("name", createdDebts);
});

test("debt card shows the real next due date (not '—')", async ({ page }) => {
  await uiLogin(page);
  await expect(page).toHaveURL(/\/app(\/|$)/);
  await page.goto("/app/debts");

  const name = `e2e-due-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  createdDebts.push(name);
  await page.getByRole("button", { name: "New debt" }).click();
  await page.getByLabel("Debt nickname / description").fill(name);
  await selectDebtType(page, "Mortgage");
  await page.getByLabel("Current balance").fill("1000");
  await page.getByLabel("Minimum payment").fill("100");
  await page.getByLabel("Next due date").fill("2026-07-01");
  await page.getByRole("button", { name: "Add debt" }).click();

  const card = page.getByRole("list", { name: "Debts" }).locator("li", { hasText: name });
  await expect(card).toBeVisible();
  await expect(card).toContainText("Jul 1");
});

test("expense form: expanded groups, Pay day label, and field info-icons", async ({ page }) => {
  await uiLogin(page);
  await expect(page).toHaveURL(/\/app(\/|$)/);
  await page.goto("/app/expenses");
  await page.getByRole("button", { name: "New expense" }).click();

  // Expanded groups include Credit card.
  await expect(page.getByRole("option", { name: "Credit card" })).toHaveCount(1);
  // "Pay day" replaced "Due day".
  await expect(page.getByText("Pay day (1–31)")).toBeVisible();
  await expect(page.getByText("Due day (1–31)")).toHaveCount(0);

  // Info-icon reveals a tooltip on focus.
  await page.getByRole("button", { name: "More information" }).first().focus();
  await expect(page.getByRole("tooltip").first()).toBeVisible();
});

test("promo fields on the debt form are gated behind a toggle", async ({ page }) => {
  await uiLogin(page);
  await expect(page).toHaveURL(/\/app(\/|$)/);
  await page.goto("/app/debts");
  await page.getByRole("button", { name: "New debt" }).click();
  await selectDebtType(page, "Credit Card/Line (unsecured)");

  // Promo fields hidden until the toggle is on; issuer stays visible.
  await expect(page.getByLabel("Issuer")).toBeVisible();
  await expect(page.getByLabel("Promo APR (%)")).toHaveCount(0);
  await page.getByLabel("Has a promotional offer").check();
  await expect(page.getByLabel("Promo APR (%)")).toBeVisible();
  await expect(page.getByLabel("Promo ends")).toBeVisible();
});

test("bridge: paying a linked expense draws down the debt; un-checking restores it", async ({ page }) => {
  test.skip(!bridgeReady, "expenses.debt_id (migration 0008) not applied to nzx-dev yet");

  const debtName = `e2e-link-debt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const expName = `e2e-link-exp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  createdDebts.push(debtName);
  createdExpenses.push(expName);

  await uiLogin(page);
  await expect(page).toHaveURL(/\/app(\/|$)/);

  // Debt: $1,000 balance, $25 min.
  await page.goto("/app/debts");
  await page.getByRole("button", { name: "New debt" }).click();
  await page.getByLabel("Debt nickname / description").fill(debtName);
  await selectDebtType(page, "Credit Card/Line (unsecured)");
  await page.getByLabel("Current balance").fill("1000");
  await page.getByLabel("Minimum payment").fill("25");
  await page.getByLabel("Next due date").fill("2026-07-10");
  await page.getByRole("button", { name: "Add debt" }).click();
  await expect(page.getByRole("list", { name: "Debts" }).locator("li", { hasText: debtName })).toBeVisible();

  // Expense: $200, linked to the debt.
  await page.goto("/app/expenses");
  await page.getByRole("button", { name: "New expense" }).click();
  await page.getByLabel("Name").fill(expName);
  await page.getByLabel("Amount").fill("200");
  await page.getByLabel("Pay toward debt").selectOption({ label: debtName });
  await page.getByLabel("Pay day (1–31)").fill("10");
  await page.getByRole("button", { name: "Add expense" }).click();
  await expect(page.getByRole("list", { name: "Expenses" }).locator("li", { hasText: expName })).toBeVisible();

  // Planner: the debt's own min-payment line is hidden; the linked expense is the bill.
  await page.goto("/app/planner");
  const bills = page.getByRole("list", { name: "Bills this month" });
  await expect(bills).toContainText(expName);
  await expect(bills).not.toContainText(debtName);

  // Mark the linked expense paid → wait for the server to reflect it (paid rows get a
  // line-through) so the togglePaid action has committed before we read the balance.
  const expRow = bills.locator("li", { hasText: expName });
  await expRow.getByRole("checkbox").check();
  await expect(expRow.locator(".line-through")).toBeVisible();

  // Debt balance drops by $200 → $800.
  await page.goto("/app/debts");
  const card = page.getByRole("list", { name: "Debts" }).locator("li", { hasText: debtName });
  await expect(card.getByText("$800.00")).toBeVisible();

  // Un-check → balance restored to $1,000.
  await page.goto("/app/planner");
  await expRow.getByRole("checkbox").uncheck();
  await expect(expRow.locator(".line-through")).toHaveCount(0);
  await page.goto("/app/debts");
  await expect(card.getByText("$1,000.00")).toBeVisible();
});
