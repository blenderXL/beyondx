import type { Tier } from "./getEntitlements";

/**
 * Gate B — the Pro/Free entitlement list (separate from the release-flag list in
 * `lib/flags/registry.ts`). Maps a feature key to the minimum tier that unlocks it.
 * Adding a paid feature = add a line here; `getEntitlements()` derives its `features`
 * map from this list rather than hardcoding booleans.
 */
export type FeatureKey = "advancedCharts" | "assistant" | "exportPdf";

export const FEATURE_ACCESS: Record<FeatureKey, Tier> = {
  advancedCharts: "pro",
  assistant: "pro",
  exportPdf: "pro",
};

const TIER_RANK: Record<Tier, number> = { free: 0, pro: 1 };

/** The minimum tier required to use a feature. */
export function requiredTier(feature: FeatureKey): Tier {
  return FEATURE_ACCESS[feature];
}

/** True when `userTier` is at least `required`. */
export function tierMeets(userTier: Tier, required: Tier): boolean {
  return TIER_RANK[userTier] >= TIER_RANK[required];
}

/** Derive the boolean feature map for a tier from the access list. */
export function featuresForTier(tier: Tier): Record<FeatureKey, boolean> {
  const out = {} as Record<FeatureKey, boolean>;
  for (const key of Object.keys(FEATURE_ACCESS) as FeatureKey[]) {
    out[key] = tierMeets(tier, FEATURE_ACCESS[key]);
  }
  return out;
}
