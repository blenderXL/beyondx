import { describe, it, expect } from "vitest";
import {
  FEATURE_ACCESS,
  requiredTier,
  tierMeets,
  featuresForTier,
  type FeatureKey,
} from "@/lib/entitlements/featureAccess";

describe("featureAccess — the Pro/Free tier list", () => {
  it("maps the known Pro features to the pro tier", () => {
    expect(requiredTier("advancedCharts")).toBe("pro");
    expect(requiredTier("assistant")).toBe("pro");
    expect(requiredTier("exportPdf")).toBe("pro");
  });

  it("tierMeets: pro satisfies everything, free satisfies only free", () => {
    expect(tierMeets("pro", "pro")).toBe(true);
    expect(tierMeets("pro", "free")).toBe(true);
    expect(tierMeets("free", "free")).toBe(true);
    expect(tierMeets("free", "pro")).toBe(false);
  });

  it("featuresForTier derives the boolean map from the list", () => {
    const free = featuresForTier("free");
    const pro = featuresForTier("pro");
    for (const key of Object.keys(FEATURE_ACCESS) as FeatureKey[]) {
      // Every current feature requires pro, so free=false, pro=true.
      expect(free[key]).toBe(false);
      expect(pro[key]).toBe(true);
    }
    expect(pro.advancedCharts).toBe(true);
    expect(free.assistant).toBe(false);
  });
});
