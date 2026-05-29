import { getEntitlements, type Tier } from "@/lib/entitlements/getEntitlements";
import { UpgradeCard } from "./UpgradeCard";

interface Props {
  tier: Tier;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Server component gate. Renders children only if the user's tier meets the requirement,
 * otherwise renders an UpgradeCard (or the optional fallback).
 */
export async function RequireTier({ tier, children, fallback }: Props) {
  const { tier: userTier } = await getEntitlements();
  const meets = userTier === tier || userTier === "pro";
  if (meets) return <>{children}</>;
  return <>{fallback ?? <UpgradeCard requiredTier={tier} />}</>;
}
