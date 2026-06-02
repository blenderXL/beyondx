/**
 * Gate A — the release-flag list (separate from the Pro/Free entitlement list in
 * `lib/entitlements/featureAccess.ts`). This is the modular registry the team edits
 * at release sign-off: add a feature key here (default OFF), build behind it, then
 * flip it ON at runtime via the flag provider — no code commit needed to expose it.
 *
 * `FlagKey` is a closed union so call sites are type-checked; the actual on/off value
 * lives in the provider (Supabase `feature_flags` table now, PostHog later). The
 * `defaultEnabled` here is the *fail-safe* used when the provider has no opinion or
 * errors — keep it `false` for anything not yet released.
 */
export type FlagKey =
  | "income"
  | "expenses"
  | "savings"
  | "accounts"
  | "planner"
  | "payoffEngine"
  | "insights";

export interface FlagDefinition {
  key: FlagKey;
  description: string;
  defaultEnabled: boolean;
  owner?: string;
}

export const FLAG_REGISTRY: Record<FlagKey, FlagDefinition> = {
  income: { key: "income", description: "Income sources + configurable tithe CRUD", defaultEnabled: false },
  expenses: { key: "expenses", description: "Expenses/bills CRUD (group, payee)", defaultEnabled: false },
  savings: { key: "savings", description: "Savings pots CRUD", defaultEnabled: false },
  accounts: { key: "accounts", description: "Bank/cash accounts CRUD", defaultEnabled: false },
  planner: { key: "planner", description: "Monthly pay-cycle planner", defaultEnabled: false },
  payoffEngine: { key: "payoffEngine", description: "Snowball/avalanche payoff engine + schedule", defaultEnabled: false },
  insights: { key: "insights", description: "Insights & visualization dashboards", defaultEnabled: false },
};

export const FLAG_KEYS = Object.keys(FLAG_REGISTRY) as FlagKey[];

export function getFlagDefinition(key: FlagKey): FlagDefinition {
  return FLAG_REGISTRY[key];
}

/** The fail-safe value for a flag when the runtime provider has no row / errors. */
export function flagDefault(key: FlagKey): boolean {
  return FLAG_REGISTRY[key].defaultEnabled;
}
