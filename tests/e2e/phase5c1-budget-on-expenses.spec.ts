import { test, expect, type Locator } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { TEST_USER, hasTestCreds, hasServiceRole, uiLogin, expectOnApp } from "./helpers/auth";

// Phase 5C-1: the Budget summary + the variable-income "this month's actual" editor now live on
// the Expenses hub. Setting a variable source's actual flows into the hub's Income figure.
test.skip(
  !hasTestCreds() || !hasServiceRole(),
  "Set TEST_USER_* and SUPABASE_SERVICE_ROLE_KEY to run the Phase-5C-1 budget-on-expenses E2E",
);
test.describe.configure({ mode: "serial" });

const stamp = Date.now();
const incomeName = `e2e-p5c1-income-${stamp}`;

function ownerClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
async function setFlag(key: string, enabled: boolean) {
  const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { error } = await sc.from("feature_flags").upsert({ key, enabled }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}
async function signedInOwner() {
  const c = ownerClient();
  const { data } = await c.auth.signInWithPassword({ email: TEST_USER.email, password: TEST_USER.password });
  return { c, profile_id: data.user!.id };
}
function statValue(page: import("@playwright/test").Page, label: string): Locator {
  return page
    .getByRole("complementary", { name: "This month" })
    .getByText(label, { exact: true })
    .locator("xpath=following-sibling::dd");
}

let incomeId = "";

test.beforeAll(async () => {
  if (!hasTestCreds()) return;
  const { c, profile_id } = await signedInOwner();
  const { data } = await c
    .from("incomes")
    .insert({ profile_id, source: incomeName, amount: 2000, cadence: "monthly", pay_day: 1, is_variable: true })
    .select("id")
    .single();
  incomeId = data!.id;
});

test.afterAll(async () => {
  if (!hasTestCreds()) return;
  const { c } = await signedInOwner();
  await c.from("income_overrides").delete().eq("income_id", incomeId);
  await c.from("incomes").delete().eq("source", incomeName);
});

test("the Expenses hub shows the budget summary cards", async ({ page }) => {
  await setFlag("expenses", true);
  await uiLogin(page);
  await expectOnApp(page);
  await page.goto("/app/expenses");

  await expect(page.getByText("// this month")).toBeVisible();
  await expect(statValue(page, "Income")).toBeVisible();
  await expect(statValue(page, "Budget left")).toBeVisible();
});
