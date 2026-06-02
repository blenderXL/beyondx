"use client";

// Root error boundary: catches render errors that escape the route-segment boundaries
// (including the root layout). Replaces the whole document, so it ships its own <html>.
// Reports through the telemetry seam (no-ops when Sentry is unconfigured).
import { useEffect } from "react";
import { captureError } from "@/lib/telemetry/capture";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureError(error, { boundary: "global-error", digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          background: "#0a0a0a",
          color: "#ededed",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "1.25rem" }}>Something went wrong.</h2>
        <p style={{ margin: 0, color: "#a1a1aa" }}>An unexpected error occurred. Please try again.</p>
        <button
          onClick={reset}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "0.5rem",
            border: "1px solid #3f3f46",
            background: "transparent",
            color: "#ededed",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
