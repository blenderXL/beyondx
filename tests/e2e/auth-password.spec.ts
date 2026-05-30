import { test, expect } from "@playwright/test";
import { TEST_USER, expectOnApp } from "./helpers/auth";

test.describe("Password auth", () => {
  test("valid credentials log in and reach the app", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_USER.email);
    await page.getByLabel("Password", { exact: true }).fill(TEST_USER.password);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expectOnApp(page);
  });

  test("wrong password shows a generic, non-enumerating error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_USER.email);
    await page.getByLabel("Password", { exact: true }).fill("Wrong-Pass-1A!");
    await page.getByRole("button", { name: "Log in", exact: true }).click();

    const error = page.getByText("Invalid email or password.");
    await expect(error).toBeVisible();
    // Must not leak whether the account exists or Supabase's raw wording.
    await expect(error).not.toContainText(/credentials|supabase|not found|exist/i);
    await expect(page).toHaveURL(/\/login/);
  });

  test("signup shows a generic confirm-your-email state", async ({ page }) => {
    await page.goto("/signup");
    // Re-using an existing confirmed address: Supabase returns an obfuscated
    // success (no email sent), so this exercises the generic path without
    // creating junk users or tripping the shared-SMTP rate limit.
    await page.getByLabel("Email").fill(TEST_USER.email);
    await page.getByLabel("Password", { exact: true }).fill("Str0ng-Pass!");
    await page.getByLabel("Confirm password").fill("Str0ng-Pass!");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText(/Check your inbox to confirm/i)).toBeVisible();
  });

  test("signup rejects a weak password without creating an account", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Email").fill("someone@nzxus.com");
    await page.getByLabel("Password", { exact: true }).fill("weak");
    await page.getByLabel("Confirm password").fill("weak");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText(/doesn't meet the requirements/i)).toBeVisible();
  });
});
