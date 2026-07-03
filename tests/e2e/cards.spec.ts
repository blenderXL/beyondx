import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { TEST_USER, hasTestCreds, hasServiceRole, uiLogin, expectOnApp } from "./helpers/auth";

// Payment cards (migration 0021): register a card, tag an expense with it via the inline
// picker, and see the per-card planned total in the right rail.
test.skip(
  !hasTestCreds() || !hasServiceRole(),
  "Set TEST_USER_* and SUPABASE_SERVICE_ROLE_KEY to run the payment-cards E2E",
);
test.describe.configure({ mode: "serial" });

const stamp = Date.now();
const expA = `e2e-card-exp-${stamp}`; // utility, 300
const cardName = `e2e-card-${stamp}`;

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

// Skip the suite (rather than fail) when migration 0021 hasn't reached this DB yet — mirrors
// the other column-gated specs so a fresh dev DB doesn't red the run.
let hasCards = true;

test.beforeAll(async () => {
  if (!hasTestCreds()) return;
  const { c, profile_id } = await signedInOwner();
  const probe = await c.from("cards").select("id").limit(1);
  if (probe.error) {
    hasCards = false;
    return;
  }
  await c
    .from("expenses")
    .insert([{ profile_id, category: expA, amount: 300, cadence: "monthly", expense_group: "utility", due_day: 5 }]);
});
test.afterAll(async () => {
  if (!hasTestCreds() || !hasCards) return;
  const { c } = await signedInOwner();
  await c.from("expenses").delete().eq("category", expA);
  await c.from("cards").delete().eq("name", cardName);
});

test("add a card, tag an expense with it, and see the per-card total in the rail", async ({ page }) => {
  test.skip(!hasCards, "migration 0021 (cards) not applied to this database yet");
  await setFlag("expenses", true);
  await uiLogin(page);
  await expectOnApp(page);
  await page.goto("/app/expenses");
  await page.getByLabel("Search expenses").fill(expA); // isolate our expense card

  const cardsList = page.getByRole("list", { name: "Cards" });

  // Add a card via the rail "+".
  await page.getByRole("button", { name: "New card" }).click();
  await page.getByLabel("Card name").fill(cardName);
  await page.getByRole("button", { name: "Add card", exact: true }).click();

  // The new card shows in the rail, at $0 (nothing tagged yet).
  const cardRow = cardsList.getByRole("button", { name: `Edit ${cardName}` });
  await expect(cardRow).toBeVisible();
  await expect(cardRow).toContainText("$0.00");

  // The picker lives in the editor modal — open it by clicking the bill card's body.
  const billCard = page.getByRole("list", { name: "Bills" }).locator("li", { hasText: expA });
  await billCard.getByText(expA, { exact: true }).click();
  const picker = page.getByLabel(`Payment card for ${expA}`);
  await picker.selectOption({ label: cardName });

  // The rail now rolls the expense's amount up under the card.
  await expect(cardRow).toContainText("$300.00");
  await expect(cardRow).toContainText("1 bill");

  // The pick still reads in the select AFTER the save round-trips (regression: React 19's
  // post-action form reset flashed it back to "No card" until the modal was reopened).
  await expect(picker.locator("option:checked")).toHaveText(cardName);

  await page.keyboard.press("Escape"); // close the editor
});
