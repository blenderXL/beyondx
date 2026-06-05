import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { TEST_USER, hasTestCreds, hasServiceRole, uiLogin, expectOnApp } from "./helpers/auth";

// Phase 5D: the Expenses hub gains a month switcher. The current month is the live, editable
// hub; picking a past month shows a read-only record of what was checked off that month.
test.skip(
  !hasTestCreds() || !hasServiceRole(),
  "Set TEST_USER_* and SUPABASE_SERVICE_ROLE_KEY to run the Phase-5D month-history E2E",
);
test.describe.configure({ mode: "serial" });

const stamp = Date.now();
const expName = `e2e-p5d-exp-${stamp}`;

// Last month's billing key (first of the prior UTC month).
const now = new Date();
const lastMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
const lastMonth = `${lastMonthDate.getUTCFullYear()}-${String(lastMonthDate.getUTCMonth() + 1).padStart(2, "0")}-01`;

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

test.beforeAll(async () => {
  if (!hasTestCreds()) return;
  const { c, profile_id } = await signedInOwner();
  const { data: exp } = await c
    .from("expenses")
    .insert({ profile_id, category: expName, amount: 123.45, cadence: "monthly", expense_group: "utility", due_day: 3 })
    .select("id")
    .single();
  // A payment recorded LAST month — shows only in that month's history.
  await c.from("transactions").insert({
    profile_id,
    expense_id: exp!.id,
    kind: "payment",
    amount: 123.45,
    billing_month: lastMonth,
  });
});

test.afterAll(async () => {
  if (!hasTestCreds()) return;
  const { c } = await signedInOwner();
  await c.from("expenses").delete().eq("category", expName); // transaction cascades
});

test("the current month is the live, editable hub with a month switcher", async ({ page }) => {
  await setFlag("expenses", true);
  await uiLogin(page);
  await expectOnApp(page);
  await page.goto("/app/expenses");

  await expect(page.getByLabel("Month", { exact: true })).toBeVisible();
  await expect(page.getByText("// this month")).toBeVisible(); // budget summary = live hub
});

test("picking a past month shows a read-only record of what was paid", async ({ page }) => {
  await setFlag("expenses", true);
  await uiLogin(page);
  await expectOnApp(page);
  await page.goto("/app/expenses");

  await page.getByLabel("Month", { exact: true }).selectOption(lastMonth);

  await expect(page.getByText("// expenses · history")).toBeVisible();
  const paid = page.getByRole("list", { name: "Paid items" });
  await expect(paid).toContainText(expName);
  await expect(paid).toContainText("$123.45");
  // It's read-only — no "New expense" / "Pay all" actions here.
  await expect(page.getByRole("button", { name: "New expense" })).toHaveCount(0);
});
