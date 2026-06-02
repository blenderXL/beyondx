"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";

import { posthogEnabled } from "@/lib/telemetry/capture";

/**
 * Fires `$pageview` on every client-side route change. We disable PostHog's
 * built-in autocapture (`capture_pageview: false`) because the App Router's
 * client navigations don't reliably trigger the SDK's heuristic. No-op when
 * PostHog is not configured.
 */
export function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!posthogEnabled()) return;
    if (!pathname) return;
    const qs = searchParams?.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}
