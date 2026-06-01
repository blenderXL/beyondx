import type { Tier } from "@/lib/entitlements/getEntitlements";
import { tierMeets } from "@/lib/entitlements/featureAccess";

/**
 * The composition of the two independent gates. A feature is:
 *   - visible  ⇔ its release flag is ON
 *   - locked   ⇔ visible but the user's tier doesn't meet the requirement
 *
 * release OFF            → { visible: false, locked: false }  (hidden in-progress)
 * release ON, tier OK    → { visible: true,  locked: false }  (usable)
 * release ON, tier short → { visible: true,  locked: true  }  (show Pro upsell)
 */
export interface FeatureState {
  visible: boolean;
  locked: boolean;
}

export function resolveFeature(args: {
  flagEnabled: boolean;
  userTier: Tier;
  /** Minimum tier to *use* the feature. Omit (or "free") for un-gated features. */
  requiredTier?: Tier;
}): FeatureState {
  const { flagEnabled, userTier, requiredTier = "free" } = args;
  if (!flagEnabled) return { visible: false, locked: false };
  return { visible: true, locked: !tierMeets(userTier, requiredTier) };
}
