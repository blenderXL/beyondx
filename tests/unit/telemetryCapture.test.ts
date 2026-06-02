import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Boundary mock: the only way to assert the gate forwards to Sentry without a live DSN.
const captureException = vi.fn();
vi.mock("@sentry/nextjs", () => ({ captureException: (...a: unknown[]) => captureException(...a) }));

import { sentryEnabled, posthogEnabled, captureError } from "@/lib/telemetry/capture";

const ORIGINAL = { ...process.env };

beforeEach(() => {
  captureException.mockReset();
  delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  delete process.env.SENTRY_DSN;
  delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
});
afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("sentryEnabled — env-key gate", () => {
  it("is true when either DSN env var is set", () => {
    expect(sentryEnabled({ NEXT_PUBLIC_SENTRY_DSN: "https://x@y/1" })).toBe(true);
    expect(sentryEnabled({ SENTRY_DSN: "https://x@y/1" })).toBe(true);
  });
  it("is false when no DSN is configured", () => {
    expect(sentryEnabled({})).toBe(false);
  });
});

describe("posthogEnabled — env-key gate", () => {
  it("is true only when the PostHog key is set", () => {
    expect(posthogEnabled({ NEXT_PUBLIC_POSTHOG_KEY: "phc_x" })).toBe(true);
    expect(posthogEnabled({})).toBe(false);
  });
});

describe("captureError", () => {
  it("no-ops (no throw, no Sentry call) when Sentry is not configured", () => {
    expect(() => captureError(new Error("boom"))).not.toThrow();
    expect(captureException).not.toHaveBeenCalled();
  });

  it("forwards to Sentry when a DSN is configured, passing context as extra", () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://x@y/1";
    const err = new Error("kaboom");
    captureError(err, { action: "createDebt" });
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(err, { extra: { action: "createDebt" } });
  });
});
