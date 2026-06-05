import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { TEST_USER, hasTestCreds, hasServiceRole, uiLogin, expectOnApp } from "./helpers/auth";

// Phase 5B-1: per-card check-off on the Expenses page. Checking off a debt-linked expense
// draws the balance down by PRINCIPAL only (not the full payment); un-checking restores it.
// "Pay all" checks off every expense at once (verified on a throwaway user — it's account-wide).
test.skip(
  !hasTestCreds() || !hasServiceRole(),
  "Set TEST_USER_* and SUPABASE_SERVICE_ROLE_KEY to run the Phase-5B check-off E2E",
);
test.describe.configure({ mode: "serial" });

const stamp = Date.now();
const debtName = `e2e-p5b-debt-${stamp}`;
const linkedExp = `e2e-p5b-linked-${stamp}`;
const plainExp = `e2e-p5b-plain-${stamp}`;

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function ownerClient() {
  return createClient(SUPA_URL, ANON);
}
function serviceClient() {
  return createClient(SUPA_URL, SERVICE);
}
async function setFlag(key: string, enabled: boolean) {
  const { error } = await serviceClient().from("feature_flags").upsert({ key, enabled }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}
async function signedInOwner() {
  const c = ownerClient();
  const { data } = await c.auth.signInWithPassword({ email: TEST_USER.email, password: TEST_USER.password });
  return { c, profile_id: data.user!.id };
}
const billingMonth = (() => {
  const n = new Date();
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}-01`;
})();

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
  await c.from("expenses").insert([
    { profile_id, category: linkedExp, amount: 100, cadence: "monthly", expense_group: "credit_card", due_day: 1, debt_id: debtId },
    { profile_id, category: plainExp, amount: 50, cadence: "monthly", expense_group: "utility", due_day: 2 },
  ]);
});

test.afterAll(async () => {
  if (!hasTestCreds()) return;
  const { c } = await signedInOwner();
  await c.from("expenses").delete().eq("category", linkedExp); // payment txns cascade
  await c.from("expenses").delete().eq("category", plainExp);
  await c.from("debts").delete().eq("name", debtName);
});

async function debtBalance(): Promise<number> {
  const { c } = await signedInOwner();
  const { data } = await c.from("debts").select("balance").eq("id", debtId).maybeSingle();
  return Number((data as { balance: number }).balance);
}

test("checking off a debt-linked expense draws the balance down by principal; un-checking restores it", async ({ page }) => {
  await setFlag("expenses", true);
  expect(await debtBalance()).toBe(1000);

  await uiLogin(page);
  await expectOnApp(page);
  await page.goto("/app/expenses");
  await page.getByLabel("Search expenses").fill(linkedExp);

  const box = page.getByRole("checkbox", { name: `Mark ${linkedExp} paid` });
  await expect(box).not.toBeChecked();
  await box.check();
  // $1,000 @ 24% → 20 interest; pay 100 → 80 principal → balance 920 (NOT 900).
  await expect.poll(debtBalance).toBe(920);

  await box.uncheck();
  await expect.poll(debtBalance).toBe(1000);
});

test("checking off a plain expense records a payment but moves no balance", async ({ page }) => {
  await setFlag("expenses", true);
  const { c, profile_id } = await signedInOwner();
  const paidCount = async () => {
    const { count } = await c
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profile_id)
      .eq("billing_month", billingMonth)
      .eq("kind", "payment")
      .is("debt_id", null)
      .eq("expense_id", (await expenseId(c, plainExp)) ?? "");
    return count ?? 0;
  };

  await uiLogin(page);
  await expectOnApp(page);
  await page.goto("/app/expenses");
  await page.getByLabel("Search expenses").fill(plainExp);

  await page.getByRole("checkbox", { name: `Mark ${plainExp} paid` }).check();
  await expect.poll(paidCount).toBe(1);
});

test("'Pay all' checks off every expense (isolated throwaway user)", async ({ page }) => {
  // Account-wide + balance-moving, so run it against a fresh user with only two expenses.
  const svc = serviceClient();
  const email = `e2e-payall-${stamp}@nzxus.com`;
  const password = "Test-payall-12345!";
  const created = await svc.auth.admin.createUser({ email, password, email_confirm: true });
  const uid = created.data.user!.id;
  try {
    await svc.from("expenses").insert([
      { profile_id: uid, category: `${plainExp}-pa1`, amount: 40, cadence: "monthly", expense_group: "utility", due_day: 1 },
      { profile_id: uid, category: `${plainExp}-pa2`, amount: 60, cadence: "monthly", expense_group: "subscription", due_day: 2 },
    ]);
    await setFlag("expenses", true);

    await uiLogin(page, { email, password });
    await expectOnApp(page);
    await page.goto("/app/expenses");
    await page.getByRole("button", { name: "Pay all this month" }).click();

    const paidCount = async () => {
      const { count } = await svc
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", uid)
        .eq("billing_month", billingMonth)
        .eq("kind", "payment");
      return count ?? 0;
    };
    await expect.poll(paidCount).toBe(2); // both expenses paid in one click
  } finally {
    await svc.auth.admin.deleteUser(uid); // cascades the profile, expenses, and transactions
  }
});

async function expenseId(c: ReturnType<typeof ownerClient>, category: string): Promise<string | null> {
  const { data } = await c.from("expenses").select("id").eq("category", category).maybeSingle();
  return data ? (data as { id: string }).id : null;
}
