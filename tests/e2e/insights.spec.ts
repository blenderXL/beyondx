import { test, expect } from "@playwright/test";
import { hasTestCreds, uiLogin } from "./helpers/auth";

test.skip(!hasTestCreds(), "Set TEST_USER_* to run the insights redirect E2E");

// Insights was merged into the Debt payoff planner. The old route now redirects so existing
// links/bookmarks don't 404. The distribution/utilization assertions moved to payoff.spec.ts.
test("insights: /app/insights redirects to the payoff planner", async ({ page }) => {
  await uiLogin(page);
  await expect(page).toHaveURL(/\/app(\/|$)/);
  await page.goto("/app/insights");
  await expect(page).toHaveURL(/\/app\/plans$/);
});
