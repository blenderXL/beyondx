import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { TEST_USER, hasTestCreds, hasServiceRole, uiLogin } from "./helpers/auth";

/**
 * Phase 4 — variable monthly income. Marking a source variable and setting this month's
 * actual on the Budget page both need migration 0010 (incomes.is_variable +
 * income_overrides). The spec auto-skips until that's applied to nzx-dev. The income-form
 * checkbox renders regardless (no DB dependency), so that part is unconditional.
 */
test.skip(!hasTestCreds() || !hasServiceRole(), "Set TEST_USER_* and SUPABASE_SERVICE_ROLE_KEY for P4 E2E");

const PREFIX = `e2e-p4-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const SOURCE = `${PREFIX}-gig`;
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
  await setFlag("income", true);
  await setFlag("planner", true);
  // Probe the new table — present only once migration 0010 is applied to nzx-dev.
  const c = ownerClient();
  await c.auth.signInWithPassword({ email: TEST_USER.email, password: TEST_USER.password });
  const probe = await c.from("income_overrides").select("id").limit(1);
  columnReady = !probe.error;
});

test.afterAll(async () => {
  if (!hasTestCreds()) return;
  const c = ownerClient();
  await c.auth.signInWithPassword({ email: TEST_USER.email, password: TEST_USER.password });
  // income_overrides rows cascade on the income delete.
  await c.from("incomes").delete().eq("source", SOURCE);
});

test("income form exposes the variable-income checkbox", async ({ page }) => {
  await uiLogin(page);
  await expect(page).toHaveURL(/\/app(\/|$)/);
  await page.goto("/app/income");
  await page.getByRole("button", { name: "New income" }).click();
  await expect(page.getByLabel("Variable income")).toBeVisible();
});

test("mark a source variable, set this month's actual, Budget total reflects it", async ({ page }) => {
  test.skip(!columnReady, "income_overrides / incomes.is_variable (migration 0010) not applied to nzx-dev yet");

  await uiLogin(page);
  await expect(page).toHaveURL(/\/app(\/|$)/);

  // Create a variable income source through the form (base $1,000, monthly).
  await page.goto("/app/income");
  await page.getByRole("button", { name: "New income" }).click();
  await page.getByLabel("Source").fill(SOURCE);
  await page.getByLabel("Amount").fill("1000");
  await page.getByLabel("Pay frequency").selectOption("monthly");
  await page.getByLabel("Variable income").check();
  await page.getByRole("button", { name: "Add income" }).click();
  await expect(page.getByRole("list", { name: "Income" }).locator("li", { hasText: SOURCE })).toBeVisible();

  // Budget page: the variable source gets an inline "this month's actual" editor.
  await page.goto("/app/planner");
  const editor = page.getByRole("region", { name: "Variable income" });
  await expect(editor).toContainText(SOURCE);
  await expect(editor).toContainText(/using the base amount this month/i);

  // Set this month's actual to $2,500 and confirm it sticks.
  const actual = page.getByLabel(`This month's actual for ${SOURCE}`);
  await actual.fill("2500");
  await page.getByRole("button", { name: "Set" }).click();
  await expect(editor).toContainText(/using \$2,500/i);
});
