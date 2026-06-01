import { featureState } from "@/lib/flags/server";
import { requiredTier, type FeatureKey } from "@/lib/entitlements/featureAccess";
import type { FlagKey } from "@/lib/flags/registry";
import { UpgradeCard } from "@/components/entitlements/UpgradeCard";

interface Props {
  /** Release flag (Gate A) controlling whether this feature is live at all. */
  flag: FlagKey;
  /** Optional entitlement feature (Gate B) controlling which tier may use it. */
  feature?: FeatureKey;
  children: React.ReactNode;
  /** Rendered when the feature is visible but tier-locked. Defaults to an UpgradeCard. */
  lockedFallback?: React.ReactNode;
  /** Rendered when the release flag is OFF (feature not live). Defaults to nothing. */
  hiddenFallback?: React.ReactNode;
}

/**
 * Server-component gate composing both gates (release flag + entitlement):
 *   flag OFF            → render `hiddenFallback` (default: nothing) — invisible.
 *   flag ON, tier short → render `lockedFallback` (default: UpgradeCard) — locked.
 *   flag ON, tier OK    → render children.
 * Mirrors `RequireTier`; use this whenever a screen/section is behind a release flag.
 */
export async function FeatureGate({ flag, feature, children, lockedFallback, hiddenFallback }: Props) {
  const { visible, locked } = await featureState(flag, feature);
  if (!visible) return <>{hiddenFallback ?? null}</>;
  if (locked) {
    return <>{lockedFallback ?? <UpgradeCard requiredTier={feature ? requiredTier(feature) : "pro"} />}</>;
  }
  return <>{children}</>;
}
