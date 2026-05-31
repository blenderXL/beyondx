/**
 * Dev-only: seed confirmed test users in the linked Supabase project (nzx-dev)
 * for Playwright E2E. Uses the service-role admin API so the users are created
 * already email-confirmed — the `on_auth_user_created` trigger auto-creates each
 * profile, so we never touch the `profiles` table directly. Idempotent.
 *
 * Run:  npx pnpm@9.12.3 seed:test-user
 *       (resolves to `node --env-file=.env.local --import tsx scripts/seed-test-user.ts`)
 *
 * NEVER run this against a production project, and never commit real secrets.
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
      "Run via `npx pnpm@9.12.3 seed:test-user` so .env.local is loaded.",
  );
  process.exit(1);
}

// Credentials come ONLY from env (never hardcoded — keep them out of git).
// Set TEST_USER_* / TEST_MFA_USER_* in .env.local. Matches tests/e2e/helpers/auth.ts.
const USERS = [
  { email: process.env.TEST_USER_EMAIL, password: process.env.TEST_USER_PASSWORD },
  { email: process.env.TEST_MFA_USER_EMAIL, password: process.env.TEST_MFA_USER_PASSWORD },
];

if (USERS.some((u) => !u.email || !u.password)) {
  console.error(
    "Missing test-user credentials. Set TEST_USER_EMAIL, TEST_USER_PASSWORD, " +
      "TEST_MFA_USER_EMAIL, TEST_MFA_USER_PASSWORD in .env.local.",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  for (const { email, password } of USERS) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: email!,
      password: password!,
      email_confirm: true,
    });
    if (error) {
      if (/already|registered|exists/i.test(error.message)) {
        console.log(`✓ exists   ${email}`);
        continue;
      }
      console.error(`✗ failed   ${email}: ${error.message}`);
      process.exitCode = 1;
      continue;
    }
    console.log(`✓ created  ${email} (${data.user?.id})`);
  }
}

main();
