import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { TEST_USER, hasTestCreds, hasServiceRole, uiLogin, expectOnApp } from "./helpers/auth";

// Phase 5B-2: active debts auto-appear on the Expenses page as "debt payment" bill rows,
// pre-filled with their minimum. Checking one off (or editing the amount first) draws the
// balance down by the principal portion. A debt already represented by a linked expense is
// not shown twice.
test.skip(
  !hasTestCreds() || !hasServiceRole(),
  "Set TEST_USER_* and SUPABASE_SERVICE_ROLE_KEY to run the Phase-5B-2 debt-bills E2E",
);
test.describe.configure({ mode: "serial" });

const stamp = Date.now();
const debtName = `e2e-p5b2-debt-${stamp}`; // unlinked → shows as a bill
const linkedDebt = `e2e-p5b2-linkeddebt-${stamp}`; // linked → hidden from debt bills
const linkedExp = `e2e-p5b2-linkedexp-${stamp}`;

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

let debtId = "";

test.beforeAll(async () => {
  if (!hasTestCreds()) return;
  const { c, profile_id } = await signedInOwner();
  const { data: d } = await c
    .from("debts")
    .insert({ profile_id, name: debtName, type: "credit_card", balance: 1000, apr: 24, min_payment: 100, due_day: 1 })
    .select("id")
    .single();
  debtId = d!.id;
  const { data: d2 } = await c
    .from("debts")
    .insert({ profile_id, name: linkedDebt, type: "credit_card", balance: 500, apr: 12, min_payment: 50, due_day: 1 })
    .select("id")
    .single();
  await c.from("expenses").insert({
    profile_id,
    category: linkedExp,
    amount: 50,
    cadence: "monthly",
    expense_group: "credit_card",
    due_day: 1,
    debt_id: d2!.id,
  });
});

test.afterAll(async () => {
  if (!hasTestCreds()) return;
  const { c } = await signedInOwner();
  await c.from("expenses").delete().eq("category", linkedExp);
  await c.from("debts").delete().eq("name", debtName);
  await c.from("debts").delete().eq("name", linkedDebt);
});

async function balance(): Promise<number> {
  const { c } = await signedInOwner();
  const { data } = await c.from("debts").select("balance").eq("id", debtId).maybeSingle();
  return Number((data as { balance: number }).balance);
}

test("an unlinked debt shows as a bill row; a linked debt does not", async ({ page }) => {
  await setFlag("expenses", true);
  await uiLogin(page);
  await expectOnApp(page);
  await page.goto("/app/expenses");

  const debtBills = page.getByRole("list", { name: "Debt payments" });
  await expect(debtBills.getByRole("listitem").filter({ hasText: debtName })).toBeVisible();
  // The linked debt is represented by its expense, not a duplicate debt bill.
  await expect(debtBills.getByRole("listitem").filter({ hasText: linkedDebt })).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Expenses" }).getByRole("listitem").filter({ hasText: linkedExp })).toBeVisible();
});

test("checking off a debt bill at its minimum draws the balance down by principal", async ({ page }) => {
  await setFlag("expenses", true);
  expect(await balance()).toBe(1000);

  await uiLogin(page);
  await expectOnApp(page);
  await page.goto("/app/expenses");

  const box = page.getByRole("checkbox", { name: `Mark ${debtName} paid` });
  await box.scrollIntoViewIfNeeded();
  await box.check();
  // min 100 @ 24% on 1000 → interest 20, principal 80 → balance 920.
  await expect.poll(balance).toBe(920);

  await box.uncheck();
  await expect.poll(balance).toBe(1000);
});

test("editing the payment amount changes how much principal comes off", async ({ page }) => {
  await setFlag("expenses", true);
  expect(await balance()).toBe(1000);

  await uiLogin(page);
  await expectOnApp(page);
  await page.goto("/app/expenses");

  await page.getByLabel(`Payment for ${debtName}`).fill("200");
  const box = page.getByRole("checkbox", { name: `Mark ${debtName} paid` });
  await box.check();
  // pay 200 @ 24% on 1000 → interest 20, principal 180 → balance 820.
  await expect.poll(balance).toBe(820);

  await box.uncheck();
  await expect.poll(balance).toBe(1000);
});
