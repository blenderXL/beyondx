// Sentry browser init. On Next 15.1 the SDK auto-loads `sentry.client.config.ts`
// (the `instrumentation-client.ts` convention needs Next 15.3+). Guards on the public DSN.
// No Sentry Session Replay here — PostHog owns replay, and we mask everything for privacy.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_APP_VERSION,
  });
}
