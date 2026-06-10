import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { TEST_USER, MFA_USER, hasTestCreds, hasMfaCreds, uiLogin } from "./helpers/auth";

/** The type picker is a custom ARIA listbox now — open it and click the option by its label. */
async function selectDebtType(page: Page, optionLabel: string) {
  await page.getByRole("button", { name: "Type of debt" }).click();
  // Scope to the custom listbox — the debts page's "Filter by type" <select> behind the modal
  // exposes options with the same labels.
  await page.getByRole("listbox", { name: "Type of debt" }).getByRole("option", { name: optionLabel }).click();
}

// All debt specs need the password-login user; without creds, skip rather than fail.
test.skip(!hasTestCreds(), "Set TEST_USER_EMAIL / TEST_USER_PASSWORD to run debt-management E2E");

// Track created debts so afterAll can delete them (keeps the dev project clean).
const createdNames: string[] = [];
function uniqueName(prefix: string): string {
  const name = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  createdNames.push(name);
  return name;
}

function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

test.afterAll(async () => {
  if (!hasTestCreds() || createdNames.length === 0) return;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;
  const supabase = anonClient();
  await supabase.auth.signInWithPassword({ email: TEST_USER.email, password: TEST_USER.password });
  // RLS lets the owner delete their own rows — clears both active and archived test debts.
  await supabase.from("debts").delete().in("name", createdNames);
});

test.describe("Debt management", () => {
  test("create → charge → payment (floors at 0) → edit balance → archive", async ({ page }) => {
    page.on("dialog", (d) => d.accept()); // accept the archive confirmation

    await uiLogin(page);
    await expect(page).toHaveURL(/\/app(\/|$)/); // let the login redirect set the session cookie first
    await page.goto("/app/debts");
    await expect(page.getByRole("heading", { name: "Your debts" })).toBeVisible();

    const list = page.getByRole("list", { name: "Debts" });
    const name = uniqueName("e2e-debt");

    // Create with a credit limit so utilization renders (1000 / 2000 = 50%).
    await page.getByRole("button", { name: "New debt" }).click();
    await page.getByLabel("Debt nickname / description").fill(name);
    await selectDebtType(page, "Credit Card/Line (unsecured)");
    await page.getByLabel("Current balance").fill("1000");
    await page.getByLabel("Interest rate (%)", { exact: true }).fill("24.24");
    await page.getByLabel("Credit limit").fill("2000");
    await page.getByLabel("Minimum payment").fill("25"); // keeps the $0.00 balance assertion unambiguous
    await page.getByLabel("Next due date").fill("2026-07-01");
    await page.getByRole("button", { name: "Add debt" }).click();

    const card = () => list.locator("li", { hasText: name });
    await expect(card()).toBeVisible();
    await expect(card().getByText("$1,000.00")).toBeVisible();
    await expect(card().getByText("50%")).toBeVisible();

    // The card is a button now — everything (txns, edit, archive) lives in its detail modal,
    // whose header balance updates live as transactions post.
    const dialog = page.getByRole("dialog", { name: "Debt details" });
    // dispatchEvent — a plain click() races: opening the card spawns a modal that covers it.
    const openCard = () => page.getByRole("button", { name: `Open ${name}` }).dispatchEvent("click");
    await openCard();

    // Charge +250 → 1250.
    await dialog.getByRole("button", { name: "New charge" }).click({ force: true });
    await dialog.getByLabel("Amount").fill("250");
    await dialog.getByRole("button", { name: "Record" }).click({ force: true });
    // .first() = the header balance (the transaction form's live preview echoes the figure too).
    await expect(dialog.getByText("$1,250.00").first()).toBeVisible();

    // Payment of 1500 against a 1250 balance → floored at 0, never negative.
    await dialog.getByRole("button", { name: "Paid down" }).click({ force: true });
    await dialog.getByLabel("Amount").fill("1500");
    await dialog.getByRole("button", { name: "Record" }).click({ force: true });
    await expect(dialog.getByText("$0.00").first()).toBeVisible();

    // The payment shows up in recent activity (behind the modal).
    const activity = page.getByRole("list", { name: "Recent activity" });
    await expect(activity.locator("li", { hasText: name }).first()).toBeVisible();

    // Edit the balance directly (the edit form lives in the modal) → 500; Save closes the modal.
    await dialog.getByLabel("Current balance").fill("500");
    await dialog.getByRole("button", { name: "Save debt" }).click({ force: true });
    await expect(card().getByText("$500.00")).toBeVisible();

    // Archive (from the modal) → drops out of the active list.
    await openCard();
    await dialog.getByRole("button", { name: "Archive" }).click({ force: true });
    await expect(list.locator("li", { hasText: name })).toHaveCount(0);
  });

  test("deleting a manual transaction reverses the balance", async ({ page }) => {
    await uiLogin(page);
    await expect(page).toHaveURL(/\/app(\/|$)/);
    await page.goto("/app/debts");

    const list = page.getByRole("list", { name: "Debts" });
    const name = uniqueName("e2e-del");
    await page.getByRole("button", { name: "New debt" }).click();
    await page.getByLabel("Debt nickname / description").fill(name);
    await selectDebtType(page, "Credit Card/Line (unsecured)");
    await page.getByLabel("Current balance").fill("1000");
    await page.getByLabel("Interest rate (%)", { exact: true }).fill("20");
    await page.getByLabel("Minimum payment").fill("25");
    await page.getByLabel("Next due date").fill("2026-07-01");
    await page.getByRole("button", { name: "Add debt" }).click();

    const card = () => list.locator("li", { hasText: name });
    await expect(card().getByText("$1,000.00")).toBeVisible();

    // Record a $200 payment → 800, then delete it from the modal → back to 1000.
    const dialog = page.getByRole("dialog", { name: "Debt details" });
    await page.getByRole("button", { name: `Open ${name}` }).dispatchEvent("click");
    await dialog.getByRole("button", { name: "Paid down" }).click({ force: true });
    await dialog.getByLabel("Amount").fill("200");
    await dialog.getByRole("button", { name: "Record" }).click({ force: true });
    await expect(dialog.getByText("$800.00").first()).toBeVisible(); // modal header balance updates live

    await dialog.getByRole("button", { name: "Delete transaction" }).first().click({ force: true });
    await expect(dialog.getByText("$1,000.00").first()).toBeVisible(); // delete reverses the balance
  });

  test("server rejects out-of-range input (APR above the column max)", async ({ page }) => {
    await uiLogin(page);
    await expect(page).toHaveURL(/\/app(\/|$)/); // let the login redirect set the session cookie first
    await page.goto("/app/debts");

    await page.getByRole("button", { name: "New debt" }).click();
    await page.getByLabel("Debt nickname / description").fill(uniqueName("e2e-invalid"));
    // Medical is exempt from the required Next Due Date, so the submit reaches the server rate check.
    await selectDebtType(page, "Medical Bill");
    await page.getByLabel("Current balance").fill("100");
    await page.getByLabel("Minimum payment").fill("10"); // now required
    await page.getByLabel("Interest rate (%)", { exact: true }).fill("150");
    await page.getByRole("button", { name: "Add debt" }).click();

    await expect(page.getByText(/APR can't exceed/i)).toBeVisible();
  });

  test("form fields adapt to the selected debt type", async ({ page }) => {
    await uiLogin(page);
    await expect(page).toHaveURL(/\/app(\/|$)/);
    await page.goto("/app/debts");
    await page.getByRole("button", { name: "New debt" }).click();

    // The custom picker opens an ARIA listbox with one option per debt type.
    await page.getByRole("button", { name: "Type of debt" }).click();
    const listbox = page.getByRole("listbox", { name: "Type of debt" });
    await expect(listbox).toBeVisible();
    await expect(listbox.getByRole("option")).toHaveCount(11);
    await listbox.getByRole("option", { name: "Credit Card/Line (unsecured)" }).click();

    // Credit card → credit limit AND next due date show.
    await expect(page.getByLabel("Credit limit")).toBeVisible();
    await expect(page.getByLabel("Next due date")).toBeVisible();

    // Mortgage → no credit limit, but still a next due date.
    await selectDebtType(page, "Mortgage");
    await expect(page.getByLabel("Credit limit")).toHaveCount(0);
    await expect(page.getByLabel("Next due date")).toBeVisible();

    // Medical → neither (exempt from the due date).
    await selectDebtType(page, "Medical Bill");
    await expect(page.getByLabel("Credit limit")).toHaveCount(0);
    await expect(page.getByLabel("Next due date")).toHaveCount(0);
  });

  test("RLS hides one user's debt from another", async () => {
    test.skip(!hasMfaCreds(), "Set TEST_MFA_USER_* for the second user in the RLS isolation test");

    const owner = anonClient();
    const { data: ownerAuth, error: ownerErr } = await owner.auth.signInWithPassword({
      email: TEST_USER.email,
      password: TEST_USER.password,
    });
    expect(ownerErr).toBeNull();
    expect(ownerAuth.user).toBeTruthy();

    const name = uniqueName("e2e-rls");
    const { data: inserted, error: insErr } = await owner
      .from("debts")
      .insert({ profile_id: ownerAuth.user!.id, name, type: "other", balance: 1 })
      .select("id")
      .single();
    expect(insErr).toBeNull();
    expect(inserted?.id).toBeTruthy();

    // A different signed-in user must neither read nor write that row.
    const other = anonClient();
    await other.auth.signInWithPassword({ email: MFA_USER.email, password: MFA_USER.password });

    const { data: leaked } = await other.from("debts").select("id").eq("id", inserted!.id);
    expect(leaked).toEqual([]);

    const { data: updated } = await other
      .from("debts")
      .update({ balance: 999 })
      .eq("id", inserted!.id)
      .select("id");
    expect(updated).toEqual([]);

    await owner.from("debts").delete().eq("id", inserted!.id);
  });
});
