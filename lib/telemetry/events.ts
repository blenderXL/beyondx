/**
 * Typed product-event registry — the single list of analytics events sent to PostHog.
 * Mirrors `lib/flags/registry.ts`: a closed union so call sites are type-checked, plus a
 * runtime list for iteration/guards. Add an event here, then emit it via `track()` in
 * `lib/telemetry/capture.ts`. Keep PII and financial values OUT of event props — use
 * counts, enums, and ids only.
 */
export type TelemetryEvent =
  | "auth_signed_in"
  | "auth_signed_out"
  | "debt_created"
  | "plan_run"
  | "bill_marked_paid";

export const TELEMETRY_EVENTS: readonly TelemetryEvent[] = [
  "auth_signed_in",
  "auth_signed_out",
  "debt_created",
  "plan_run",
  "bill_marked_paid",
] as const;

/** Allowed event properties — non-sensitive scalars only (no balances, amounts, or PII). */
export type TelemetryProps = Record<string, string | number | boolean | null>;

export function isTelemetryEvent(value: string): value is TelemetryEvent {
  return (TELEMETRY_EVENTS as readonly string[]).includes(value);
}
