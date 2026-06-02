// Next.js instrumentation hook. register() runs once per runtime at startup; we load the
// matching Sentry config by runtime. onRequestError forwards Server Component / route errors
// to Sentry (Next 15+). All of this no-ops when no DSN is set (the configs guard on it).
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
