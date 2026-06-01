import { getSupabaseServerClient } from "@/lib/supabase/server";
import { featuresForTier, type FeatureKey } from "./featureAccess";

export type Tier = "free" | "pro";

export interface Entitlements {
  tier: Tier;
  assistantMessagesRemaining: number;
  /** Per-feature access, derived from the `featureAccess` list (single source of truth). */
  features: Record<FeatureKey, boolean>;
}

const PRO_MONTHLY_ASSISTANT_QUOTA = 200;

/**
 * Single source of truth for what a user can do.
 * v1.0: always returns the free shape (subscriptions not wired yet).
 * v1.1: reads `tier`, `current_period_end`, `subscription_status` from `profiles`.
 * v1.2: also reads `assistant_messages_used_this_period`.
 */
export async function getEntitlements(): Promise<Entitlements> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return freeEntitlements();

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier, subscription_status, current_period_end, assistant_messages_used_this_period")
    .eq("id", user.id)
    .single();

  if (!profile) return freeEntitlements();

  const isActivePro =
    profile.tier === "pro" &&
    (profile.subscription_status === "active" || profile.subscription_status === "trialing") &&
    (!profile.current_period_end || new Date(profile.current_period_end) > new Date());

  if (!isActivePro) return freeEntitlements();

  const used = profile.assistant_messages_used_this_period ?? 0;
  return {
    tier: "pro",
    assistantMessagesRemaining: Math.max(0, PRO_MONTHLY_ASSISTANT_QUOTA - used),
    features: featuresForTier("pro"),
  };
}

export function freeEntitlements(): Entitlements {
  return {
    tier: "free",
    assistantMessagesRemaining: 0,
    features: featuresForTier("free"),
  };
}
