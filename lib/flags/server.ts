// Server-only: transitively imports next/headers via the Supabase server client,
// so importing this from a client component fails the build (no extra dep needed).
import { getEntitlements } from "@/lib/entitlements/getEntitlements";
import { requiredTier, type FeatureKey } from "@/lib/entitlements/featureAccess";
import { resolveFeature, type FeatureState } from "./resolve";
import { STATIC_FLAG_PROVIDER, type FlagProvider } from "./provider";
import { SupabaseFlagProvider } from "./supabaseProvider";
import type { FlagKey } from "./registry";

/**
 * Pick the active release-flag backend. Interim: the Supabase `feature_flags` table
 * when Supabase is configured; otherwise the static registry defaults. Swapped to
 * `PostHogFlagProvider` in Track B · B2 by changing only this function.
 */
export function getFlagProvider(): FlagProvider {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) return new SupabaseFlagProvider();
  return STATIC_FLAG_PROVIDER;
}

/**
 * Compose the two gates for one feature: its release flag (Gate A) and, optionally,
 * the tier it requires (Gate B). Returns `{ visible, locked }`. Server-only — reads
 * cookies via the Supabase client.
 */
export async function featureState(flagKey: FlagKey, feature?: FeatureKey): Promise<FeatureState> {
  const provider = getFlagProvider();
  const [flagEnabled, entitlements] = await Promise.all([provider.isEnabled(flagKey), getEntitlements()]);
  return resolveFeature({
    flagEnabled,
    userTier: entitlements.tier,
    requiredTier: feature ? requiredTier(feature) : "free",
  });
}
