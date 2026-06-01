import { describe, it, expect } from "vitest";
import {
  STATIC_FLAG_PROVIDER,
  resolveFlagRow,
} from "@/lib/flags/provider";
import { FLAG_KEYS, flagDefault } from "@/lib/flags/registry";

describe("resolveFlagRow — fail-safe row resolution", () => {
  it("uses the row's enabled value when a row exists", () => {
    expect(resolveFlagRow("income", { enabled: true })).toBe(true);
    expect(resolveFlagRow("income", { enabled: false })).toBe(false);
  });

  it("falls back to the registry default when the row is absent (null/undefined)", () => {
    expect(resolveFlagRow("income", null)).toBe(flagDefault("income"));
    expect(resolveFlagRow("income", undefined)).toBe(flagDefault("income"));
  });
});

describe("STATIC_FLAG_PROVIDER — registry defaults, no backend", () => {
  it("isEnabled returns the registry default for each key", async () => {
    for (const key of FLAG_KEYS) {
      expect(await STATIC_FLAG_PROVIDER.isEnabled(key)).toBe(flagDefault(key));
    }
  });

  it("allFlags returns the full default map", async () => {
    const all = await STATIC_FLAG_PROVIDER.allFlags();
    expect(Object.keys(all).sort()).toEqual([...FLAG_KEYS].sort());
    expect(all.income).toBe(flagDefault("income"));
  });
});
