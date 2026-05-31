import { test, expect } from "@playwright/test";
import { MFA_USER, totpCode, clearMfaFactors, hasMfaCreds, expectOnApp } from "./helpers/auth";

// Credentials are env-only (never committed). Without them, skip rather than fail.
test.skip(!hasMfaCreds(), "Set TEST_MFA_USER_EMAIL / TEST_MFA_USER_PASSWORD to run MFA E2E");

// Serial: the steps build on one enrolled factor for a shared dev user.
test.describe.configure({ mode: "serial" });

test.describe("MFA (TOTP)", () => {
  // Both Playwright projects target Chromium and share one dev user — running
  // the flow twice in parallel would race on that user's factors. Pin to one.
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "MFA flow runs on a single project");
  });

  // Best-effort pre/post cleanup when a valid service-role key is available
  // (recovers from a crashed run). The test also self-cleans via the UI.
  test.beforeAll(async () => {
    await clearMfaFactors(MFA_USER.email);
  });
  test.afterAll(async () => {
    await clearMfaFactors(MFA_USER.email);
  });

  async function login(page: import("@playwright/test").Page) {
    await page.goto("/login");
    await page.getByLabel("Email").fill(MFA_USER.email);
    await page.getByLabel("Password", { exact: true }).fill(MFA_USER.password);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
  }

  test("enroll, step-up at next login, and middleware enforces AAL2", async ({ page }) => {
    test.setTimeout(90_000); // may wait out a 30s TOTP window for a fresh code

    // 1) First login (no factor yet) lands straight on the app.
    await login(page);
    await expectOnApp(page);

    // 2) Enroll a TOTP factor from Security settings.
    await page.goto("/app/settings/security");
    await page.getByRole("button", { name: /Enable 2FA/i }).click();
    const secret = ((await page.getByTestId("mfa-secret").textContent()) ?? "").trim();
    expect(secret.length).toBeGreaterThan(0);
    const enrollCode = totpCode(secret);
    await page.getByLabel("Authenticator code").fill(enrollCode);
    await page.getByRole("button", { name: /Verify & enable/i }).click();
    await expect(page.getByText(/2FA is on/i)).toBeVisible();

    // 3) Sign out.
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/(login)?$/);

    // 4) Logging in again now stops at the MFA challenge.
    await login(page);
    await expect(page).toHaveURL(/\/login\/verify/);

    // 5) Middleware: a still-AAL1 session can't reach /app/* — it bounces back.
    await page.goto("/app/debts");
    await expect(page).toHaveURL(/\/login\/verify/);

    // 6) A fresh code completes step-up and reaches the requested page.
    let code = totpCode(secret);
    if (code === enrollCode) {
      await page.waitForTimeout(31_000); // new 30s window → distinct, non-replayed code
      code = totpCode(secret);
    }
    await page.getByLabel("Authenticator code").fill(code);
    await page.getByRole("button", { name: "Verify", exact: true }).click();
    await expectOnApp(page);

    // 7) Self-clean: at AAL2 we can disable the factor, leaving the user pristine.
    await page.goto("/app/settings/security");
    await page.getByRole("button", { name: /Disable 2FA/i }).click();
    await expect(page.getByRole("button", { name: /Enable 2FA/i })).toBeVisible();
  });
});
