import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import pkg from "./package.json";

const config: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // typedRoutes — re-enable once /legal/* pages exist and derived hrefs are typed.
    typedRoutes: false,
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // Build-time inject of the app version (from package.json) → Sentry release + PostHog
  // super-property. Only the inlined string ships to the client, not package.json.
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
};

// Source-map upload is gated on SENTRY_AUTH_TOKEN so builds without it (local, previews)
// still succeed; the token is supplied only in the prod deploy. Wrapping is otherwise inert
// when no DSN is configured.
export default withSentryConfig(config, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  telemetry: false,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
