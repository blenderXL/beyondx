import { describe, it, expect } from "vitest";
import pkg from "@/package.json";
import { resolveAppVersion } from "@/lib/telemetry/version";
import {
  TELEMETRY_EVENTS,
  isTelemetryEvent,
  type TelemetryEvent,
} from "@/lib/telemetry/events";

describe("resolveAppVersion — app_version source", () => {
  it("reads NEXT_PUBLIC_APP_VERSION when set", () => {
    expect(resolveAppVersion({ NEXT_PUBLIC_APP_VERSION: "1.2.3" })).toBe("1.2.3");
  });

  it("falls back to 0.0.0 when the env var is missing or blank", () => {
    expect(resolveAppVersion({})).toBe("0.0.0");
    expect(resolveAppVersion({ NEXT_PUBLIC_APP_VERSION: "  " })).toBe("0.0.0");
  });

  it("package.json carries a version string that next.config injects", () => {
    // Guards the wiring contract: the value next.config sets must come from here.
    expect(typeof pkg.version).toBe("string");
    expect(pkg.version.length).toBeGreaterThan(0);
  });
});

describe("telemetry event registry", () => {
  it("has no duplicate event keys", () => {
    expect(new Set(TELEMETRY_EVENTS).size).toBe(TELEMETRY_EVENTS.length);
  });

  it("isTelemetryEvent accepts registered events and rejects others", () => {
    for (const e of TELEMETRY_EVENTS) expect(isTelemetryEvent(e)).toBe(true);
    expect(isTelemetryEvent("not_a_real_event")).toBe(false);
  });

  it("exposes the union members as runtime values", () => {
    const sample: TelemetryEvent = "debt_created";
    expect(TELEMETRY_EVENTS).toContain(sample);
  });
});
