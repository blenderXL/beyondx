"use client";

import { useEffect } from "react";

import { identifyUser } from "@/lib/telemetry/capture";

/**
 * Calls `identifyUser(userId)` once on mount (and whenever the id changes).
 * Mounted under the authenticated app shell so the resolved Supabase user id
 * gets associated with the PostHog distinct id. ID-only — never accepts email
 * or any other PII. No-op when PostHog is not configured.
 */
export function IdentifyUser({ userId }: { userId: string }) {
  useEffect(() => {
    identifyUser(userId);
  }, [userId]);

  return null;
}
