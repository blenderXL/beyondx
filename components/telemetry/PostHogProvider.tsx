"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

import { APP_VERSION } from "@/lib/telemetry/version";
import { posthogEnabled, posthogInitOptions } from "@/lib/telemetry/capture";

/**
 * Initializes PostHog once on mount with the privacy-first config from
 * `posthogInitOptions`. Renders children unchanged. No-ops (no init, no
 * network) when `NEXT_PUBLIC_POSTHOG_KEY` is absent, so local dev / CI / any
 * preview without keys stays silent.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!posthogEnabled()) return;
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;
    posthog.init(key, posthogInitOptions());
    // `app_version` super-property tags every event with the release that emitted it.
    posthog.register({ app_version: APP_VERSION });
  }, []);

  return <>{children}</>;
}
