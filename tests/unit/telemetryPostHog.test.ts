import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Boundary mock: assert the gate forwards to posthog-js without a live key.
const capture = vi.fn();
const identify = vi.fn();
const reset = vi.fn();
const register = vi.fn();
vi.mock("posthog-js", () => ({
  default: {
    capture: (...a: unknown[]) => capture(...a),
    identify: (...a: unknown[]) => identify(...a),
    reset: (...a: unknown[]) => reset(...a),
    register: (...a: unknown[]) => register(...a),
  },
}));

import {
  posthogEnabled,
  track,
  identifyUser,
  resetUser,
  posthogInitOptions,
} from "@/lib/telemetry/capture";

const ORIGINAL = { ...process.env };

beforeEach(() => {
  capture.mockReset();
  identify.mockReset();
  reset.mockReset();
  register.mockReset();
  delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
  delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
});
afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("track — analytics event seam", () => {
  it("no-ops (no throw, no posthog call) when PostHog is not configured", () => {
    expect(() => track("debt_created")).not.toThrow();
    expect(capture).not.toHaveBeenCalled();
  });

  it("forwards to posthog.capture with event name + props when key is set", () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_x";
    track("debt_created", { debt_type: "credit_card" });
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith("debt_created", { debt_type: "credit_card" });
  });

  it("forwards event with no props as a bare capture call", () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_x";
    track("plan_run");
    expect(capture).toHaveBeenCalledWith("plan_run", undefined);
  });
});

describe("identifyUser — id-only contract", () => {
  it("no-ops when PostHog is not configured", () => {
    identifyUser("user-abc");
    expect(identify).not.toHaveBeenCalled();
  });

  it("calls posthog.identify with the user id ONLY (no email, no PII)", () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_x";
    identifyUser("user-abc");
    expect(identify).toHaveBeenCalledTimes(1);
    // exactly one arg — no $set properties carrying email or other PII
    expect(identify).toHaveBeenCalledWith("user-abc");
    expect(identify.mock.calls[0]).toHaveLength(1);
  });
});

describe("resetUser — sign-out hook", () => {
  it("no-ops when PostHog is not configured", () => {
    resetUser();
    expect(reset).not.toHaveBeenCalled();
  });

  it("calls posthog.reset when configured", () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_x";
    resetUser();
    expect(reset).toHaveBeenCalledTimes(1);
  });
});

describe("posthogInitOptions — privacy contract", () => {
  it("masks all inputs and all text in session replay (financial-app guard)", () => {
    const opts = posthogInitOptions();
    expect(opts.session_recording?.maskAllInputs).toBe(true);
    // Either maskAllText or a wildcard mask selector — both honor the contract.
    const rec = opts.session_recording as { maskAllText?: boolean; maskTextSelector?: string };
    expect(rec.maskAllText === true || rec.maskTextSelector === "*").toBe(true);
  });

  it("disables auto pageview capture (we capture manually on route change)", () => {
    expect(posthogInitOptions().capture_pageview).toBe(false);
  });

  it("uses identified_only person profiles (no anon person creation)", () => {
    expect(posthogInitOptions().person_profiles).toBe("identified_only");
  });

  it("falls back to us.i.posthog.com when host env is unset", () => {
    expect(posthogInitOptions({}).api_host).toBe("https://us.i.posthog.com");
  });

  it("honors a custom api_host from env", () => {
    expect(posthogInitOptions({ NEXT_PUBLIC_POSTHOG_HOST: "https://eu.i.posthog.com" }).api_host).toBe(
      "https://eu.i.posthog.com",
    );
  });
});

describe("posthogEnabled — env-key gate (PostHog-specific re-check)", () => {
  it("is false without a key", () => {
    expect(posthogEnabled({})).toBe(false);
  });
  it("is true with a key", () => {
    expect(posthogEnabled({ NEXT_PUBLIC_POSTHOG_KEY: "phc_x" })).toBe(true);
  });
});
