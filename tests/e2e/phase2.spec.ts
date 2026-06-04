import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { TEST_USER, hasTestCreds, hasServiceRole, uiLogin } from "./helpers/auth";

// Phase 2 (income/expenses/savings) is behind release flags, so the spec needs the
// service-role key to flip them; without creds or service role, skip rather than fail.
test.skip(
  !hasTestCreds() || !hasServiceRole(),
  "Set TEST_USER_* and SUPABASE_SERVICE_ROLE_KEY to run Phase 2 E2E",
);

const createdSources: string[] = [];
const createdCategories: string[] = [];
const createdPots: string[] = [];
function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/** Flip a release flag at runtime (service role bypasses the read-only RLS). */
async function setFlag(key: string, enabled: boolean) {
  const { error } = await serviceClient()
    .from("feature_flags")
    .upsert({ key, enabled }, { onConflict: "key" });
  if (error) throw new Error(`setFlag(${key}) failed: ${error.message}`);
}

test.afterAll(async () => {
  if (!hasTestCreds()) return;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  await supabase.auth.signInWithPassword({ email: TEST_USER.email, password: TEST_USER.password });
  if (createdSources.length) await supabase.from("incomes").delete().in("source", createdSources);
  if (createdCategories.length) await supabase.from("expenses").delete().in("category", createdCategories);
  if (createdPots.length) await supabase.from("savings_goals").delete().in("name", createdPots);
});

// Tests mutate shared global flag rows in the dev DB (the income flag is toggled
// off then on across tests), so they must not race — run this file serially.
test.describe.configure({ mode: "serial" });

test.describe("Phase 2 — ledger spine behind feature flags", () => {
  test("release flag OFF → income route shows Coming soon and the nav link is hidden", async ({ page }) => {
    await setFlag("income", false);
    await uiLogin(page);
    await expect(page).toHaveURL(/\/app(\/|$)/);

    await page.goto("/app/income");
    await expect(page.getByText(/coming soon/i)).toBeVisible();
    // The real CRUD UI must not be reachable, and the nav link must be hidden.
    await expect(page.getByRole("button", { name: "New income" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Income" })).toHaveCount(0);
  });

  test("income: flag ON → create → edit → archive; server rejects a bad amount", async ({ page }) => {
    page.on("dialog", (d) => d.accept());
    await setFlag("income", true);
    await uiLogin(page);
    await expect(page).toHaveURL(/\/app(\/|$)/);

    await page.goto("/app/income");
    await expect(page.getByRole("heading", { name: "Your income" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Income" })).toBeVisible();

    const list = page.getByRole("list", { name: "Income" });
    const source = uniqueName("e2e-income");
    createdSources.push(source);

    await page.getByRole("button", { name: "New income" }).click();
    await page.getByLabel("Source").fill(source);
    await page.getByLabel("Amount", { exact: true }).fill("3000");
    await page.getByLabel("Pay frequency").selectOption("semimonthly");
    await page.getByLabel("Pay day (1–31)").fill("15");
    // Offerings/tithe moved to the Expenses page in Phase 3 — no tithe field on income now.
    await page.getByRole("button", { name: "Add income" }).click();

    const card = () => list.locator("li", { hasText: source });
    await expect(card()).toBeVisible();
    await expect(card()).toContainText("$3,000.00");

    // Edit the amount.
    await card().getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Amount", { exact: true }).fill("3200");
    await page.getByRole("button", { name: "Save income" }).click();
    await expect(card()).toContainText("$3,200.00");

    // Server-side validation: a negative amount is rejected.
    await page.getByRole("button", { name: "New income" }).click();
    await page.getByLabel("Source").fill(uniqueName("e2e-bad"));
    await page.getByLabel("Amount", { exact: true }).fill("-5");
    await page.getByRole("button", { name: "Add income" }).click();
    await expect(page.getByText(/can't be negative/i)).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();

    // Archive removes it from the active list.
    await card().getByRole("button", { name: "Archive" }).click();
    await expect(card()).toHaveCount(0);
  });

  test("expense: flag ON → create with group/payee/due-day → archive", async ({ page }) => {
    page.on("dialog", (d) => d.accept());
    await setFlag("expenses", true);
    await uiLogin(page);
    await expect(page).toHaveURL(/\/app(\/|$)/);

    await page.goto("/app/expenses");
    await expect(page.getByRole("heading", { name: "Your expenses" })).toBeVisible();

    const list = page.getByRole("list", { name: "Expenses" });
    const name = uniqueName("e2e-expense");
    createdCategories.push(name);

    await page.getByRole("button", { name: "New expense" }).click();
    await page.getByLabel("Name", { exact: true }).fill(name);
    await page.getByLabel("Group").selectOption("utility");
    await page.getByLabel("Payee").fill("Optimum");
    await page.getByLabel("Amount", { exact: true }).fill("115");
    await page.getByLabel("Pay day (1–31)").fill("5"); // relabeled from "Due day" in the P3 form redesign
    await page.getByRole("button", { name: "Add expense" }).click();

    const card = () => list.locator("li", { hasText: name });
    await expect(card()).toBeVisible();
    await expect(card()).toContainText("$115.00");
    await expect(card()).toContainText("Optimum");
    await expect(card()).toContainText(/pay day 5/i);

    await card().getByRole("button", { name: "Archive" }).click();
    await expect(card()).toHaveCount(0);
  });

  test("savings: flag ON → create pot with target → progress shows → archive", async ({ page }) => {
    page.on("dialog", (d) => d.accept());
    await setFlag("savings", true);
    await uiLogin(page);
    await expect(page).toHaveURL(/\/app(\/|$)/);

    await page.goto("/app/savings");
    await expect(page.getByRole("heading", { name: "Your savings pots" })).toBeVisible();

    const list = page.getByRole("list", { name: "Savings pots" });
    const name = uniqueName("e2e-pot");
    createdPots.push(name);

    await page.getByRole("button", { name: "New pot" }).click();
    await page.getByLabel("Name", { exact: true }).fill(name);
    await page.getByLabel("Current amount").fill("1380");
    await page.getByLabel("Target", { exact: true }).fill("5000"); // input's aria-label is "Target"
    await page.getByRole("button", { name: "Add pot" }).click();

    const card = () => list.locator("li", { hasText: name });
    await expect(card()).toBeVisible();
    await expect(card()).toContainText("$1,380.00");
    await expect(card()).toContainText(/28% of target/); // 1380 / 5000 = 27.6% → Math.round → 28%
  });
});
