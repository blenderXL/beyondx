/**
 * App version string, surfaced to Sentry (`release`) and PostHog (super-property).
 * Wired from `package.json` at build via next.config's `env` (→ `NEXT_PUBLIC_APP_VERSION`),
 * so neither package.json nor the rest of its contents end up in the client bundle — only
 * the inlined version string literal does. Reads the env at call time so it's testable.
 */
export function resolveAppVersion(env: Record<string, string | undefined> = process.env): string {
  return env.NEXT_PUBLIC_APP_VERSION?.trim() || "0.0.0";
}

export const APP_VERSION = resolveAppVersion();
