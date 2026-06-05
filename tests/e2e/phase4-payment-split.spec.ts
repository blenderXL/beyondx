import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { TEST_USER, hasTestCreds, hasServiceRole, uiLogin, expectOnApp } from "./helpers/auth";

// Phase 4: escrow/PMI fields on property-secured debts, and a "Principal" card metric that
// shows how much of the minimum payment actually reduces the balance (min − interest − escrow).
test.skip(
  !hasTestCreds() || !hasServiceRole(),
  "Set TEST_USER_* and SUPABASE_SERVICE_ROLE_KEY to run the Phase-4 payment-split E2E",
);
test.describe.configure({ mode: "serial" });

const stamp = Date.now();
const cardDebt = `e2e-p4-card-${stamp}`;
const mortgageDebt = `e2e-p4-mortgage-${stamp}`;

function ownerClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
async function signedInOwner() {
  const c = ownerClient();
  const { data } = await c.auth.signInWithPassword({ email: TEST_USER.email, password: TEST_USER.password });
  return { c, profile_id: data.user!.id };
}
/** Open the custom debt-type picker and choose an option by label. */
async function selectDebtType(page: Page, label: string) {
  await page.getByRole("button", { name: "Type of debt" }).click();
  await page.getByRole("option", { name: label }).click();
}

test.afterAll(async () => {
  if (!hasTestCreds()) return;
  const { c } = await signedInOwner();
  await c.from("debts").delete().eq("name", cardDebt);
  await c.from("debts").delete().eq("name", mortgageDebt);
});

test("escrow + PMI fields show for a mortgage, not for a credit card", async ({ page }) => {
  await uiLogin(page);
  await expectOnApp(page);
  await page.goto("/app/debts");
  await page.getByRole("button", { name: "New debt" }).click();

  await selectDebtType(page, "Credit Card/Line (unsecured)");
  await expect(page.getByLabel("Escrow / mo")).toHaveCount(0);
  await expect(page.getByLabel("PMI / mo")).toHaveCount(0);

  await selectDebtType(page, "Mortgage");
  await expect(page.getByLabel("Escrow / mo")).toBeVisible();
  await expect(page.getByLabel("PMI / mo")).toBeVisible();
});

test("a debt card shows the Principal portion of the minimum (min − interest)", async ({ page }) => {
  const { c, profile_id } = await signedInOwner();
  // $1,000 @ 24% → 20 interest; min 100 → 80 to principal.
  await c.from("debts").insert({
    profile_id,
    name: cardDebt,
    type: "credit_card",
    balance: 1000,
    apr: 24,
    min_payment: 100,
    due_day: 1,
  });

  await uiLogin(page);
  await expectOnApp(page);
  await page.goto("/app/debts");
  await page.getByLabel("Search debts").fill(cardDebt); // narrow to just this card

  const card = page.getByRole("listitem").filter({ hasText: cardDebt });
  await expect(card).toBeVisible();
  await expect(card).toContainText("Principal");
  await expect(card).toContainText("$80.00");
});

test("a mortgage's escrow flows into its Principal metric (needs migration 0014)", async ({ page }) => {
  // Writing escrow needs the 0014 column on nzx-dev — gate until deploy-dev applies it.
  const { c } = await signedInOwner();
  const probe = await c.from("debts").select("escrow").limit(1);
  test.skip(Boolean(probe.error), "debts.escrow not migrated yet (0014)");

  await uiLogin(page);
  await expectOnApp(page);
  await page.goto("/app/debts");
  await page.getByRole("button", { name: "New debt" }).click();

  await page.getByLabel("Debt nickname / description").fill(mortgageDebt);
  await selectDebtType(page, "Mortgage");
  await page.getByLabel("Current balance").fill("200000");
  await page.getByLabel("Minimum payment").fill("1500");
  await page.getByLabel("Interest rate (%)").fill("6");
  await page.getByLabel("Next due date").fill("2026-07-01");
  await page.getByLabel("Escrow / mo").fill("300");
  await page.getByRole("button", { name: "Add debt" }).click();

  // $200,000 @ 6% → 1000 interest; min 1500 − 300 escrow − 1000 = 200 principal.
  await page.getByLabel("Search debts").fill(mortgageDebt);
  const card = page.getByRole("listitem").filter({ hasText: mortgageDebt });
  await expect(card).toBeVisible();
  await expect(card).toContainText("Principal");
  await expect(card).toContainText("$200.00");
});
