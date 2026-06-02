// Sentry server-runtime init. Loaded by instrumentation.ts's register() on the Node runtime.
// Guards on DSN presence so local dev / CI with no DSN stay completely silent. Privacy:
// sendDefaultPii is false — never attach request bodies, cookies, or user PII (financial app).
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_APP_VERSION,
  });
}
