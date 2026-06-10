import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { hasTestCreds, hasServiceRole, uiLogin, expectOnApp } from "./helpers/auth";

// Expenses list view + "paid sinks to the bottom". Account-wide ordering, so run against a
// fresh throwaway user with exactly two expenses (mirrors the phase5b 'Pay all' isolation).
test.skip(
  !hasTestCreds() || !hasServiceRole(),
  "Set TEST_USER_* and SUPABASE_SERVICE_ROLE_KEY to run the expenses list-view E2E",
);

const stamp = Date.now();

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}
async function setFlag(key: string, enabled: boolean) {
  const { error } = await serviceClient().from("feature_flags").upsert({ key, enabled }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}

test("list view renders rows; paying an expense moves it to the bottom", async ({ page }) => {
  const svc = serviceClient();
  const email = `e2e-listview-${stamp}@nzxus.com`;
  const password = "Test-listview-12345!";
  const created = await svc.auth.admin.createUser({ email, password, email_confirm: true });
  const uid = created.data.user!.id;
  // "AAA…" sorts (and lists) before "ZZZ…"; default sort is amount high→low, so give AAA the
  // bigger amount to keep it first until it's paid.
  const first = `AAA-listview-${stamp}`;
  const second = `ZZZ-listview-${stamp}`;
  try {
    await svc.from("expenses").insert([
      { profile_id: uid, category: first, amount: 200, cadence: "monthly", expense_group: "utility", due_day: 1 },
      { profile_id: uid, category: second, amount: 100, cadence: "monthly", expense_group: "subscription", due_day: 2 },
    ]);
    await setFlag("expenses", true);

    await uiLogin(page, { email, password });
    await expectOnApp(page);
    await page.goto("/app/expenses");

    // Switch to the new list view.
    await page.getByRole("button", { name: "List view" }).click();
    const list = page.getByRole("list", { name: "Expenses" });
    await expect(list.locator("li")).toHaveCount(2);

    const order = async () =>
      list.locator("li").evaluateAll((lis) =>
        lis.map((li) => li.querySelector("span.font-medium")?.textContent?.trim() ?? ""),
      );

    // Unpaid: the $200 expense leads.
    expect(await order()).toEqual([first, second]);

    // Pay the leading expense → it sinks below the still-unpaid one.
    await page.getByRole("button", { name: `Pay ${first}` }).click();
    await expect(page.getByRole("button", { name: `Revert ${first}` })).toBeVisible();
    await expect.poll(order).toEqual([second, first]);
  } finally {
    await svc.auth.admin.deleteUser(uid); // cascades the profile + expenses + transactions
  }
});
