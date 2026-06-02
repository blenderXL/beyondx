/**
 * The telemetry choke point. Feature code calls `captureError` / `track` here instead of
 * importing vendor SDKs directly, so swapping or removing a vendor never touches features
 * (mirrors the `LLMProvider` / `FlagProvider` "interface-not-vendor" idiom). Both forward
 * only when the vendor's env key is present, so local dev and CI stay silent with no keys.
 */
import * as Sentry from "@sentry/nextjs";

/** Sentry is active iff a DSN is configured (client or server). */
export function sentryEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.NEXT_PUBLIC_SENTRY_DSN || env.SENTRY_DSN);
}

/** PostHog is active iff its public key is configured. */
export function posthogEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.NEXT_PUBLIC_POSTHOG_KEY);
}

/**
 * Report a handled error to Sentry. Use this on the error branches of server actions, which
 * return a Result `{ error }` rather than throwing — Sentry would otherwise never see them.
 * No-ops when Sentry is not configured.
 */
export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (!sentryEnabled()) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
