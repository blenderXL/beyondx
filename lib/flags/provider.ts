import { FLAG_KEYS, flagDefault, type FlagKey } from "./registry";

/** Optional resolution context (e.g. for per-user targeting / % rollout later). */
export interface FlagContext {
  userId?: string;
}

/**
 * Provider-agnostic release-flag interface, mirroring `LLMProvider` in
 * `lib/llm/provider.ts`. Implementations: `STATIC_FLAG_PROVIDER` (registry defaults),
 * `SupabaseFlagProvider` (interim runtime backend), and later `PostHogFlagProvider`.
 * Swapping providers never touches the registry or call sites.
 */
export interface FlagProvider {
  readonly name: string;
  isEnabled(key: FlagKey, ctx?: FlagContext): Promise<boolean>;
  allFlags(ctx?: FlagContext): Promise<Record<FlagKey, boolean>>;
}

/**
 * Pure resolution of one flag against its (optional) backend row, with a fail-safe
 * to the registry default. Kept pure so the fallback behaviour is unit-tested without I/O.
 */
export function resolveFlagRow(key: FlagKey, row: { enabled: boolean } | null | undefined): boolean {
  if (row == null) return flagDefault(key);
  return row.enabled;
}

/** No-backend provider: every flag resolves to its registry default. */
export const STATIC_FLAG_PROVIDER: FlagProvider = {
  name: "static",
  async isEnabled(key) {
    return flagDefault(key);
  },
  async allFlags() {
    const out = {} as Record<FlagKey, boolean>;
    for (const key of FLAG_KEYS) out[key] = flagDefault(key);
    return out;
  },
};
