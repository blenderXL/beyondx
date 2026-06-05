import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { TEST_USER, hasTestCreds, hasServiceRole, uiLogin, expectOnApp } from "./helpers/auth";

// Phase 2: payoff-method selection drives the order (client-side, no migration needed),
// and is persisted on the profile so Insights agrees (gated on migration 0013).
test.skip(
  !hasTestCreds() || !hasServiceRole(),
  "Set TEST_USER_* and SUPABASE_SERVICE_ROLE_KEY to run the Phase-2 payoff-method E2E",
);
test.describe.configure({ mode: "serial" });

const stamp = Date.now();
// A: small balance, low APR.  B: big balance, high APR.  → snowball puts A first, avalanche B first.
const debtA = `e2e-p2-A-${stamp}`;
const debtB = `e2e-p2-B-${stamp}`;

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
  await c.from("debts").insert([
    { profile_id, name: debtA, balance: 500, apr: 5, min_payment: 50, due_day: 1 },
    { profile_id, name: debtB, balance: 5000, apr: 30, min_payment: 50, due_day: 1 },
  ]);
});

test.afterAll(async () => {
  if (!hasTestCreds()) return;
  const { c, profile_id } = await signedInOwner();
  await c.from("debts").delete().eq("name", debtA);
  await c.from("debts").delete().eq("name", debtB);
  // Restore the default so other specs see the avalanche curve (no-op pre-migration).
  await c.from("profiles").update({ payoff_method: null }).eq("id", profile_id);
});

/** 0-based position of a debt (by name) within the rendered "Payoff order" list. */
async function orderIndex(page: import("@playwright/test").Page, name: string): Promise<number> {
  const items = await page.getByRole("list", { name: "Payoff order" }).getByRole("listitem").allInnerTexts();
  return items.findIndex((t) => t.includes(name));
}

test("the payoff-method select offers all six strategies", async ({ page }) => {
  await setFlag("payoffEngine", true);
  await uiLogin(page);
  await expectOnApp(page);
  await page.goto("/app/plans");

  const select = page.getByLabel("Method", { exact: true });
  for (const value of ["avalanche", "snowball", "cfi", "highest_balance", "highest_payment", "custom"]) {
    await expect(select.locator(`option[value="${value}"]`)).toHaveCount(1);
  }
});

test("method drives ordering + persists across reload + Insights curve label", async ({ page }) => {
  // The interactive flow relies on the server action persisting payoff_method; pre-migration
  // the write no-ops and the action's refresh snaps the select back to the default. Gate the
  // whole flow on the 0013 column (deploy-dev applies it on merge).
  const { c } = await signedInOwner();
  const probe = await c.from("profiles").select("payoff_method").limit(1);
  test.skip(Boolean(probe.error), "profiles.payoff_method not migrated yet (0013)");

  await setFlag("payoffEngine", true);
  await setFlag("insights", true);
  await uiLogin(page);
  await expectOnApp(page);
  await page.goto("/app/plans");

  const select = page.getByLabel("Method", { exact: true });
  await expect.poll(() => orderIndex(page, debtA)).toBeGreaterThanOrEqual(0); // list rendered

  await select.selectOption("snowball"); // smallest balance first → A (500) before B (5000)
  await expect.poll(async () => (await orderIndex(page, debtA)) < (await orderIndex(page, debtB))).toBe(true);

  await select.selectOption("avalanche"); // highest APR first → B (30%) before A (5%)
  await expect.poll(async () => (await orderIndex(page, debtB)) < (await orderIndex(page, debtA))).toBe(true);

  await select.selectOption("highest_balance"); // largest balance first → B (5000) before A (500)
  await expect.poll(async () => (await orderIndex(page, debtB)) < (await orderIndex(page, debtA))).toBe(true);

  // Persisted: snowball survives a reload (no localStorage involved for the method).
  await select.selectOption("snowball");
  await expect(select).toHaveValue("snowball");
  await page.reload();
  await expect(page.getByLabel("Method", { exact: true })).toHaveValue("snowball");

  // Insights reflects the same method in its curve label.
  await page.goto("/app/insights");
  await expect(page.getByText("// payoff curve (snowball)")).toBeVisible();
});
