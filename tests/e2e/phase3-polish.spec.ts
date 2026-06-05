import { test, expect, type Locator } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { TEST_USER, hasTestCreds, hasServiceRole, uiLogin, expectOnApp } from "./helpers/auth";

// Phase 3 polish: clearer "Min. payments / mo" label, the debts toolbar on one row (desktop),
// and evenly-spaced payoff-table columns.
test.skip(
  !hasTestCreds() || !hasServiceRole(),
  "Set TEST_USER_* and SUPABASE_SERVICE_ROLE_KEY to run the Phase-3 polish E2E",
);

const stamp = Date.now();
const debtX = `e2e-p3-X-${stamp}`;
const debtY = `e2e-p3-Y-${stamp}`;

function ownerClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
async function setFlag(key: string, enabled: boolean) {
  const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { error } = await sc.from("feature_flags").upsert({ key, enabled }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}
async function centerY(loc: Locator): Promise<number> {
  const box = await loc.boundingBox();
  if (!box) throw new Error("no bounding box");
  return box.y + box.height / 2;
}

test.beforeAll(async () => {
  if (!hasTestCreds()) return;
  const c = ownerClient();
  const { data } = await c.auth.signInWithPassword({ email: TEST_USER.email, password: TEST_USER.password });
  await c.from("debts").insert([
    { profile_id: data.user!.id, name: debtX, balance: 400, apr: 0, min_payment: 25, due_day: 1 },
    { profile_id: data.user!.id, name: debtY, balance: 800, apr: 0, min_payment: 25, due_day: 1 },
  ]);
});
test.afterAll(async () => {
  if (!hasTestCreds()) return;
  const c = ownerClient();
  await c.auth.signInWithPassword({ email: TEST_USER.email, password: TEST_USER.password });
  await c.from("debts").delete().eq("name", debtX);
  await c.from("debts").delete().eq("name", debtY);
});

test("debts header reads 'Min. payments / mo'", async ({ page }) => {
  await uiLogin(page);
  await expectOnApp(page);
  await page.goto("/app/debts");
  await expect(page.getByText("Min. payments / mo")).toBeVisible();
});

test("debts toolbar sits on a single row (desktop)", async ({ page }) => {
  const vp = page.viewportSize();
  test.skip(!vp || vp.width < 700, "one-line toolbar is a desktop layout");

  await uiLogin(page);
  await expectOnApp(page);
  await page.goto("/app/debts");

  const search = page.getByLabel("Search debts");
  const filter = page.getByLabel("Filter by type");
  const sort = page.getByLabel("Sort debts");
  const view = page.getByLabel("Card view");
  await expect(search).toBeVisible();

  const ys = await Promise.all([search, filter, sort, view].map(centerY));
  const spread = Math.max(...ys) - Math.min(...ys);
  // All four controls share one row → their vertical centers line up (small tolerance).
  expect(spread).toBeLessThan(16);
});

test("payoff month-by-month columns are evenly spaced", async ({ page }) => {
  await setFlag("payoffEngine", true);
  await uiLogin(page);
  await expectOnApp(page);
  await page.goto("/app/plans");

  // A large budget guarantees the schedule is feasible so the table renders.
  await page.getByLabel("Monthly budget").fill("99999999");

  const table = page.getByRole("table", { name: "Month-by-month payoff schedule" });
  await expect(table).toBeVisible();

  // Compare every value column (all but the first "Month" column) — they must be equal width.
  const headers = table.getByRole("columnheader");
  const count = await headers.count();
  const widths: number[] = [];
  for (let i = 1; i < count; i++) {
    const box = await headers.nth(i).boundingBox();
    if (box) widths.push(box.width);
  }
  expect(widths.length).toBeGreaterThan(1);
  const spread = Math.max(...widths) - Math.min(...widths);
  expect(spread).toBeLessThan(2); // sub-pixel — uniform columns
});
