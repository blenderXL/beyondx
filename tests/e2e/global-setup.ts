import { CURRENT_LEGAL_VERSION } from "../../lib/legal/version";

/**
 * Before the suite runs, mark the seeded test users as having accepted the current legal version.
 * The first-login consent gate (app/(app)/app/layout.tsx) blocks the whole app until accepted, so
 * without this every authenticated spec would be blocked once migration 0020 is applied. Uses the
 * service role via PostgREST; a failure (e.g. the column doesn't exist yet, pre-0020) is ignored —
 * the gate is inert in that case anyway.
 */
export default async function globalSetup() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const emails = [process.env.TEST_USER_EMAIL, process.env.TEST_MFA_USER_EMAIL].filter(Boolean) as string[];
  if (!url || !key || emails.length === 0) return; // no creds → authed specs already skip.

  for (const email of emails) {
    try {
      await fetch(`${url}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}`, {
        method: "PATCH",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          accepted_legal_version: CURRENT_LEGAL_VERSION,
          accepted_legal_at: new Date().toISOString(),
        }),
      });
    } catch {
      /* pre-migration or offline — ignore; the gate is inert without the column. */
    }
  }
}
