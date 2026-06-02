/**
 * The telemetry choke point. Feature code calls `captureError` / `track` /
 * `identifyUser` / `resetUser` here instead of importing vendor SDKs directly,
 * so swapping or removing a vendor never touches features (mirrors the
 * `LLMProvider` / `FlagProvider` "interface-not-vendor" idiom). Everything
 * forwards only when the vendor's env key is present, so local dev and CI stay
 * silent with no keys.
 */
import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";

import type { TelemetryEvent, TelemetryProps } from "./events";

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

/**
 * Emit a product-analytics event to PostHog. Props must be non-sensitive scalars
 * (see `TelemetryProps` — no balances, amounts, or PII). No-ops when PostHog is
 * not configured.
 */
export function track(event: TelemetryEvent, props?: TelemetryProps): void {
  if (!posthogEnabled()) return;
  posthog.capture(event, props);
}

/**
 * Associate subsequent events with a user. ID-only by design — no email or
 * other PII may be added here. No-ops when PostHog is not configured.
 */
export function identifyUser(userId: string): void {
  if (!posthogEnabled()) return;
  posthog.identify(userId);
}

/**
 * Forget the current user (call on sign-out). Without this, the next signed-in
 * session would be merged into the previous user's profile. No-ops when PostHog
 * is not configured.
 */
export function resetUser(): void {
  if (!posthogEnabled()) return;
  posthog.reset();
}

/**
 * Privacy-first session-replay + capture options. Pure function so the masking
 * contract is unit-testable without spinning up PostHog. Consumed by
 * `<PostHogProvider>` at mount time.
 */
export function posthogInitOptions(
  env: Record<string, string | undefined> = process.env,
): {
  api_host: string;
  capture_pageview: false;
  person_profiles: "identified_only";
  session_recording: { maskAllInputs: true; maskTextSelector: "*" };
} {
  return {
    api_host: env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    capture_pageview: false,
    person_profiles: "identified_only",
    session_recording: { maskAllInputs: true, maskTextSelector: "*" },
  };
}
