import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { TEST_USER, hasTestCreds, hasServiceRole, uiLogin, expectOnApp } from "./helpers/auth";
import { CURRENT_LEGAL_VERSION } from "../../lib/legal/version";

/**
 * First-login legal consent gate. Requires migration 0020 (profiles.accepted_legal_version +
 * legal_acceptances) — auto-skips until it's applied to nzx-dev. Runs serially because it flips
 * the shared test user's acceptance state.
 */
test.skip(
  !hasTestCreds() || !hasServiceRole(),
  "Set TEST_USER_* and SUPABASE_SERVICE_ROLE_KEY to run the legal-consent E2E",
);
test.describe.configure({ mode: "serial" });

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

let columnReady = false;

test.beforeAll(async () => {
  if (!hasTestCreds() || !hasServiceRole()) return;
  const probe = await serviceClient().from("profiles").select("accepted_legal_version").limit(1);
  columnReady = !probe.error;
});

test.afterAll(async () => {
  if (!columnReady) return;
  // Leave the user accepted so other (serial) specs aren't blocked by the gate.
  await serviceClient()
    .from("profiles")
    .update({ accepted_legal_version: CURRENT_LEGAL_VERSION, accepted_legal_at: new Date().toISOString() })
    .eq("email", TEST_USER.email);
});

test("gate blocks the app until accepted, then records the acceptance", async ({ page }) => {
  test.skip(!columnReady, "profiles.accepted_legal_version (migration 0020) not applied yet");

  const sc = serviceClient();
  // Reset to unaccepted so the gate appears.
  await sc.from("profiles").update({ accepted_legal_version: null, accepted_legal_at: null }).eq("email", TEST_USER.email);

  await uiLogin(page);
  await page.goto("/app");

  const gate = page.getByRole("dialog", { name: "Before you continue" });
  await expect(gate).toBeVisible();
  await expect(page.getByText("NZX is not financial advice.")).toBeVisible();

  // Can't continue until the box is checked.
  const submit = page.getByRole("button", { name: "Agree & continue" });
  await expect(submit).toBeDisabled();

  await page.getByLabel("I have read and agree").check();
  await expect(submit).toBeEnabled();
  await submit.click();

  // Gate dismisses and the app is usable.
  await expect(gate).toBeHidden();
  await expectOnApp(page);

  // Persisted: profile stamped + an append-only audit row exists.
  const { data: profile } = await sc
    .from("profiles")
    .select("id, accepted_legal_version")
    .eq("email", TEST_USER.email)
    .maybeSingle();
  expect(profile?.accepted_legal_version).toBe(CURRENT_LEGAL_VERSION);

  const { data: rows } = await sc
    .from("legal_acceptances")
    .select("version")
    .eq("profile_id", (profile as { id: string }).id)
    .eq("version", CURRENT_LEGAL_VERSION);
  expect((rows ?? []).length).toBeGreaterThan(0);

  // Reload: gate does not reappear.
  await page.reload();
  await expect(page.getByRole("dialog", { name: "Before you continue" })).toBeHidden();
});
