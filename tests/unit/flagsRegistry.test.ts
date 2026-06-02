import { describe, it, expect } from "vitest";
import {
  FLAG_REGISTRY,
  FLAG_KEYS,
  getFlagDefinition,
  flagDefault,
  type FlagKey,
} from "@/lib/flags/registry";

describe("flags registry — the modular release-flag list", () => {
  it("every registry entry is self-consistent (key matches map key, has a description)", () => {
    for (const key of FLAG_KEYS) {
      const def = FLAG_REGISTRY[key];
      expect(def.key).toBe(key);
      expect(def.description.length).toBeGreaterThan(0);
      expect(typeof def.defaultEnabled).toBe("boolean");
    }
  });

  it("in-progress features default to OFF (safe default — hidden until release sign-off)", () => {
    expect(flagDefault("income")).toBe(false);
    expect(flagDefault("expenses")).toBe(false);
  });

  it("getFlagDefinition returns the definition for a known key", () => {
    const def = getFlagDefinition("income" as FlagKey);
    expect(def.key).toBe("income");
    expect(def.defaultEnabled).toBe(false);
  });
});
