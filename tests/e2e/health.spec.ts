import { test, expect } from "@playwright/test";

test("/api/health returns ok", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.status).toBe("ok");
});
