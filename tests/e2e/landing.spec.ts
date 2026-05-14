import { test, expect } from "@playwright/test";

test.describe("Landing page", () => {
  test("renders hero, sections, and footer", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/NZX/);
    await expect(page.locator("text=Plan your way out")).toBeVisible();
    await expect(page.locator("text=Scroll Down")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Type your numbers in/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /An AI assistant/i })).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
  });

  test("centerpiece SVG is present and labelled", async ({ page }) => {
    await page.goto("/");
    const centerpiece = page.getByRole("img", { name: /debt balance falling toward zero/i });
    await expect(centerpiece).toBeVisible();
  });

  test("Day/Night toggle persists across reloads", async ({ page }) => {
    await page.goto("/");
    const toggle = page.getByRole("switch", { name: /toggle day and night/i });
    await toggle.click();
    await expect.poll(() =>
      page.evaluate(() => document.documentElement.classList.contains("theme-light")),
    ).toBe(true);
    await page.reload();
    await expect.poll(() =>
      page.evaluate(() => document.documentElement.classList.contains("theme-light")),
    ).toBe(true);
  });

  test("primary nav links resolve", async ({ page }) => {
    await page.goto("/");
    for (const href of ["/about", "/pricing", "/faq"]) {
      const res = await page.request.get(href);
      expect(res.status(), `GET ${href}`).toBeLessThan(400);
    }
  });
});
