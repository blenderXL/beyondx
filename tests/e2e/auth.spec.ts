import { test, expect } from "@playwright/test";

test.describe("Auth pages", () => {
  test("login page renders email + Google + disabled Apple", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /Log in/i })).toBeVisible();
    await expect(page.getByPlaceholder("you@example.com")).toBeVisible();
    await expect(page.getByRole("button", { name: /Continue with Google/i })).toBeEnabled();
    await expect(page.getByRole("button", { name: /Continue with Apple/i })).toBeDisabled();
  });

  test("signup page links back to login", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: /Create account/i })).toBeVisible();
    await page.getByRole("link", { name: /Have an account/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated /app redirects to /login", async ({ page }) => {
    await page.goto("/app");
    await expect(page).toHaveURL(/\/login/);
  });
});
