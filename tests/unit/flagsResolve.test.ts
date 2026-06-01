import { describe, it, expect } from "vitest";
import { resolveFeature } from "@/lib/flags/resolve";

describe("resolveFeature — composing release flag + entitlement into {visible, locked}", () => {
  it("release flag OFF → not visible at all (hidden in-progress work), regardless of tier", () => {
    expect(resolveFeature({ flagEnabled: false, userTier: "pro", requiredTier: "free" })).toEqual({
      visible: false,
      locked: false,
    });
    expect(resolveFeature({ flagEnabled: false, userTier: "free", requiredTier: "pro" })).toEqual({
      visible: false,
      locked: false,
    });
  });

  it("release ON + tier sufficient → visible and unlocked", () => {
    expect(resolveFeature({ flagEnabled: true, userTier: "pro", requiredTier: "pro" })).toEqual({
      visible: true,
      locked: false,
    });
    expect(resolveFeature({ flagEnabled: true, userTier: "free", requiredTier: "free" })).toEqual({
      visible: true,
      locked: false,
    });
  });

  it("release ON + tier insufficient → visible but locked (show the Pro upsell)", () => {
    expect(resolveFeature({ flagEnabled: true, userTier: "free", requiredTier: "pro" })).toEqual({
      visible: true,
      locked: true,
    });
  });

  it("requiredTier defaults to free (un-gated) when omitted", () => {
    expect(resolveFeature({ flagEnabled: true, userTier: "free" })).toEqual({
      visible: true,
      locked: false,
    });
  });
});
