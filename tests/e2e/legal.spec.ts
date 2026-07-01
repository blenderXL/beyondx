import { test, expect } from "@playwright/test";

test.describe("Legal pages", () => {
  test("terms, privacy, and disclaimer render", async ({ page }) => {
    await page.goto("/legal/terms");
    await expect(page.getByRole("heading", { name: "Terms of Service", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: /No Professional Advice/i })).toBeVisible();

    await page.goto("/legal/privacy");
    await expect(page.getByRole("heading", { name: "Privacy Policy", level: 1 })).toBeVisible();
    await expect(page.getByText(/do not sell/i).first()).toBeVisible();

    await page.goto("/legal/disclaimer");
    await expect(page.getByRole("heading", { name: "Critical Disclaimers", level: 1 })).toBeVisible();
    await expect(page.getByText("NZX IS NOT FINANCIAL ADVICE")).toBeVisible();
  });

  test("footer legal links resolve", async ({ page }) => {
    await page.goto("/");
    for (const href of ["/legal/terms", "/legal/privacy", "/legal/disclaimer"]) {
      const res = await page.request.get(href);
      expect(res.status(), `GET ${href}`).toBeLessThan(400);
    }
  });
});
