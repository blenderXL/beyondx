import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { TEST_USER, hasTestCreds, uiLogin } from "./helpers/auth";

test.skip(!hasTestCreds(), "Set TEST_USER_* to run the expenses modal E2E");

const expName = `e2e-modal-${Date.now()}`;

function ownerClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

test.beforeAll(async () => {
  if (!hasTestCreds()) return;
  const c = ownerClient();
  const { data: auth } = await c.auth.signInWithPassword({
    email: TEST_USER.email,
    password: TEST_USER.password,
  });
  await c.from("expenses").insert({
    profile_id: auth.user!.id,
    category: expName,
    amount: 50,
    cadence: "monthly",
    expense_group: "utility",
    due_day: 3,
  });
});

test.afterAll(async () => {
  if (!hasTestCreds()) return;
  const c = ownerClient();
  await c.auth.signInWithPassword({ email: TEST_USER.email, password: TEST_USER.password });
  await c.from("expenses").delete().eq("category", expName);
});

test("card body opens the editor modal; Escape and click-away close it", async ({ page }) => {
  await uiLogin(page);
  await expect(page).toHaveURL(/\/app(\/|$)/);
  await page.goto("/app/expenses");
  await page.getByLabel("Search expenses").fill(expName); // isolate the card

  const card = page.getByRole("list", { name: "Expenses" }).locator("li", { hasText: expName });
  const dialog = page.getByRole("dialog", { name: "Edit expense" });

  // Clicking the card body (the name) opens the full editor.
  await card.getByText(expName, { exact: true }).click();
  await expect(dialog).toBeVisible();

  // Escape closes it.
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);

  // Reopen, then click the backdrop (outside the panel) to close.
  await card.getByText(expName, { exact: true }).click();
  await expect(dialog).toBeVisible();
  await page.mouse.click(15, 15);
  await expect(dialog).toHaveCount(0);
});

test("clicking the amount edits it in place without opening the modal", async ({ page }) => {
  await uiLogin(page);
  await expect(page).toHaveURL(/\/app(\/|$)/);
  await page.goto("/app/expenses");
  await page.getByLabel("Search expenses").fill(expName);

  // The dollar figure is its own control — clicking it reveals the inline editor, not the modal.
  await page.getByRole("button", { name: `Edit amount for ${expName}` }).click();
  await expect(page.getByRole("dialog", { name: "Edit expense" })).toHaveCount(0);
  await expect(page.getByLabel(`Amount for ${expName}`)).toBeVisible();
});

test("the dashboard quick-add (?new=1) opens the create modal", async ({ page }) => {
  await uiLogin(page);
  await expect(page).toHaveURL(/\/app(\/|$)/);
  await page.goto("/app/expenses?new=1");
  await expect(page.getByRole("dialog", { name: "New expense" })).toBeVisible();
  // The param is stripped so a refresh doesn't reopen it.
  await expect(page).toHaveURL(/\/app\/expenses$/);
});
