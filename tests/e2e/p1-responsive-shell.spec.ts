import { test, expect } from "@playwright/test";
import { hasTestCreds, uiLogin } from "./helpers/auth";

/**
 * Phase 1 — responsive app shell. Runs on both projects and branches on viewport:
 *  - chromium (desktop): static sidebar visible, no hamburger.
 *  - mobile-chrome (Pixel 7): hamburger present, off-canvas drawer toggles + closes on nav,
 *    the page scrolls to the bottom (the reported clip), and there's no horizontal overflow.
 */
test.skip(!hasTestCreds(), "Set TEST_USER_EMAIL / TEST_USER_PASSWORD for the responsive-shell E2E");

test("app shell adapts to viewport", async ({ page }, testInfo) => {
  const mobile = testInfo.project.name === "mobile-chrome";
  await uiLogin(page);
  await expect(page).toHaveURL(/\/app(\/|$)/);

  const hamburger = page.getByRole("button", { name: "Open navigation" });

  if (!mobile) {
    // Desktop: the static rail is the only nav; no hamburger.
    await expect(hamburger).toHaveCount(0);
    await expect(
      page.getByRole("navigation", { name: "App" }).getByRole("link", { name: "Debts" }),
    ).toBeVisible();
    return;
  }

  // Mobile: hamburger present, drawer starts closed (aria-expanded is the reliable signal).
  await expect(hamburger).toBeVisible();
  await expect(hamburger).toHaveAttribute("aria-expanded", "false");

  // Go to a content-heavy page and confirm the mobile shell scrolls + doesn't overflow sideways.
  await page.goto("/app/debts");
  await expect(page.getByRole("heading", { name: "Your debts" })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  const scrollable = await page.evaluate(
    () => document.documentElement.scrollHeight > window.innerHeight + 1,
  );
  expect(scrollable).toBe(true);

  // Open the drawer, navigate via it, and confirm it closes on the route change.
  await hamburger.click();
  await expect(hamburger).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("dialog", { name: "Navigation" }).getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/app\/settings/);
  await expect(hamburger).toHaveAttribute("aria-expanded", "false");
});
