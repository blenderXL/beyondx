import { test, expect, type Locator } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { TEST_USER, hasTestCreds, hasServiceRole, uiLogin, expectOnApp } from "./helpers/auth";

// Verifies the two Phase-1 calculation fixes render correctly in the browser:
//   1. one-time income is included in the budget income total (was dropped to $0).
//   2. a percent offering is reflected in the expenses listed total (was $0).
// Delta-based assertions keep this robust to whatever rows the shared test user already has.
test.skip(
  !hasTestCreds() || !hasServiceRole(),
  "Set TEST_USER_* and SUPABASE_SERVICE_ROLE_KEY to run the Phase-1 calc-fix E2E",
);

// These assert ACCOUNT-WIDE aggregate totals (income, listed total) against the shared
// test user. Concurrent workers mutating the same account would race the deltas, so run
// serially — locally pass `--workers=1`; CI already pins workers to 1.
test.describe.configure({ mode: "serial" });

const stamp = Date.now();
const oneTimeName = `e2e-p1-onetime-${stamp}`;
const baseIncomeName = `e2e-p1-income-${stamp}`;
const offeringName = `e2e-p1-offering-${stamp}`;

function ownerClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
async function setFlag(key: string, enabled: boolean) {
  const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { error } = await sc.from("feature_flags").upsert({ key, enabled }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}

/** "$13,650.31" → 13650.31 */
function parseUsd(text: string): number {
  return Number(text.replace(/[^0-9.-]/g, ""));
}
/** The big number inside a labeled StatCard. */
function statValue(page: import("@playwright/test").Page, label: string): Locator {
  return page.getByRole("group", { name: label, exact: true }).locator("p.tabular-nums");
}

test.afterAll(async () => {
  if (!hasTestCreds()) return;
  const c = ownerClient();
  await c.auth.signInWithPassword({ email: TEST_USER.email, password: TEST_USER.password });
  await c.from("incomes").delete().eq("source", oneTimeName);
  await c.from("incomes").delete().eq("source", baseIncomeName);
  await c.from("expenses").delete().eq("category", offeringName);
});

test("one-time income is included in the budget income total", async ({ page }) => {
  await setFlag("expenses", true); // Budget summary lives on the Expenses hub now (Phase 5C)
  const c = ownerClient();
  const { data: auth } = await c.auth.signInWithPassword({
    email: TEST_USER.email,
    password: TEST_USER.password,
  });
  const profile_id = auth.user!.id;

  await uiLogin(page);
  await expectOnApp(page);
  await page.goto("/app/expenses");

  const income = statValue(page, "Income");
  const before = parseUsd(await income.innerText());

  // Seed a one-time paycheck — under the old engine this counted as $0.
  const oneTime = 4321.5;
  await c.from("incomes").insert({
    profile_id,
    source: oneTimeName,
    amount: oneTime,
    cadence: "one_time",
    pay_day: 1,
  });

  await page.reload();
  await expect.poll(async () => parseUsd(await income.innerText())).toBeCloseTo(before + oneTime, 2);
});

test("a percent offering is reflected in the expenses listed total", async ({ page }) => {
  await setFlag("expenses", true);
  const c = ownerClient();
  const { data: auth } = await c.auth.signInWithPassword({
    email: TEST_USER.email,
    password: TEST_USER.password,
  });
  const profile_id = auth.user!.id;

  // Seed a known recurring income so total income (and thus the 10% offering) is non-zero.
  await c.from("incomes").insert({
    profile_id,
    source: baseIncomeName,
    amount: 2000,
    cadence: "monthly",
    pay_day: 1,
  });

  await uiLogin(page);
  await expectOnApp(page);

  await page.goto("/app/expenses");
  const income = parseUsd(await statValue(page, "Income").innerText());
  expect(income).toBeGreaterThan(0);

  const listed = statValue(page, "Listed total");
  const before = parseUsd(await listed.innerText());

  // A 10%-of-income offering stores amount=0; the listed total must still grow by 10% of income.
  const ins = await c.from("expenses").insert({
    profile_id,
    category: offeringName,
    amount: 0,
    cadence: "monthly",
    due_day: 1,
    expense_group: "offering",
    pct_of_income: 10,
  });
  expect(ins.error, ins.error?.message).toBeNull();

  await page.reload();
  // The offering row must render (proves it was inserted + fetched).
  await expect(page.getByText(offeringName)).toBeVisible();
  const after = parseUsd(await listed.innerText());
  const expectedDelta = Math.round(income * 10) / 100; // 10% of income, to cents
  expect(after).toBeCloseTo(before + expectedDelta, 2);
});
