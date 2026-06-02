# Dev Workflow — iterate, preview, deploy, release

> **Living doc.** How day-to-day development flows from a local edit to a dev/preview deploy to a cut release. Production is separate → [PRODUCTION-PLAN.md](./PRODUCTION-PLAN.md). Infra inventory → [PROJECT-STATE.md](./PROJECT-STATE.md).

_Last updated: 2026-06-01._

## TL;DR loop
```
branch → edit → push → Vercel Preview auto-builds on the PR → review preview URL → iterate (push again)
→ merge PR to master → deploy-dev (migrations) + release-please (Release PR) + Vercel Production redeploy
→ merge the Release PR when you want to cut a version tag
```

## Local commands (pnpm is not on PATH — use `npx pnpm@9.12.3`)
| Action | Command |
|---|---|
| Dev server | `npx pnpm@9.12.3 dev` → http://localhost:3000 |
| Build | `npx pnpm@9.12.3 build` |
| Type-check | `npx pnpm@9.12.3 typecheck` |
| Lint / format | `npx pnpm@9.12.3 lint` / `... format` |
| Unit (Vitest) | `npx pnpm@9.12.3 test` |
| E2E (Playwright) | `npx pnpm@9.12.3 test:e2e` (first time: `... exec playwright install chromium`) |
| Seed dev test users | `npx pnpm@9.12.3 seed:test-user` (needs real `nzx-dev` service_role key in `.env.local`) |
| Install after dep change | `npx pnpm@9.12.3 install` (regenerates `pnpm-lock.yaml`) |

## Auth E2E / test users
- Two seeded **nzx-dev** users back the auth specs (a password-login user and an MFA user). **Credentials come only from env — never committed:** set `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` / `TEST_MFA_USER_EMAIL` / `TEST_MFA_USER_PASSWORD` in `.env.local` (template in `.env.local.example`). `scripts/seed-test-user.ts` and `tests/e2e/helpers/auth.ts` read them; the auth/MFA specs skip if unset.
- **Seeding** uses the service-role admin API (`email_confirm: true`); the `on_auth_user_created` trigger makes the profile. Without the service_role key you can seed via GoTrue signup + a one-off `update auth.users set email_confirmed_at = now()`.
- **MFA spec** (`tests/e2e/mfa.spec.ts`) drives the full enroll → step-up → middleware-bounce flow, computing TOTP codes with `otpauth`, and self-cleans (disables the factor) at the end. It's pinned to the `chromium` project (both projects share one dev user) and bumps its own timeout (may wait out a 30s TOTP window).
- The Playwright **runner** loads `.env.local` (via `playwright.config.ts`) so helpers can reach Supabase for best-effort factor cleanup.

## Previewing changes on Vercel — **no merge required**
- **Every push to a branch with an open PR triggers a fresh Vercel Preview deployment.** The PR's **"Vercel" check** updates and a **preview URL** is attached (each commit gets its own immutable URL; the PR's "Visit Preview" points at the latest).
- You only **merge to `master`** when you want the change live on the Vercel **Production** target (`beyondx-pied.vercel.app`). Previews are the iteration surface.

## Branch → PR → merge
1. `git checkout -b <type>/<slug> master` (master is protected; never push to it directly).
2. Commit with **Conventional Commits** (`feat:`, `fix:`, `chore:`, `docs:`, `ci:`, `refactor:`, `perf:`, `test:`, `build:`) — release-please reads these for version bumps + changelog.
3. `git push -u origin <branch>`.
4. **Open the PR with the GitHub MCP** (`mcp__plugin_github_github__create_pull_request`) — `gh pr create` fails (PAT lacks PR scope).
5. CI runs two required checks: **`Lint · typecheck · unit`** and **`E2E (Playwright against local dev)`**; Vercel posts a preview. Both must be green to merge.
6. **Merge with the GitHub MCP** (`mcp__plugin_github_github__merge_pull_request`) — `gh pr merge` also fails on the PAT.

## What fires on every push to `master`
- **`Deploy · dev`** (`.github/workflows/deploy-dev.yml`): runs `supabase db push` against `nzx-dev`, applying any *new* migration files. `0001`–`0003` are already applied. **⚠️ If you apply a migration out-of-band via the Supabase MCP (`apply_migration`), it writes a timestamp version that mismatches `db push`'s expected ordering and makes the next `deploy-dev` fail** — reconcile `supabase_migrations.schema_migrations` afterward (memory `supabase-mcp-migration-version-mismatch.md`). Prefer adding the file + pushing over MCP apply.
- **`release-please`** (`.github/workflows/release-please.yml`): maintains a long-lived **Release PR** (`chore(master): release X.Y.Z`) that bumps `package.json` + `.release-please-manifest.json` and writes `CHANGELOG.md`. Authenticates with **`RELEASE_PLEASE_TOKEN`** (PAT) because the org blocks `GITHUB_TOKEN` from creating PRs.
- **Vercel** auto-deploys `master` to its **Production target** (`beyondx-pied.vercel.app`, dev Supabase for now).

## Cutting a release (dev/staging sense)
- **Merge the release-please Release PR** → it cuts tag `vX.Y.Z` + publishes a GitHub Release (also via the PAT).
- **This does NOT deploy to prod.** Prod deploy is a separate **manual** `workflow_dispatch` (see [PRODUCTION-PLAN.md](./PRODUCTION-PLAN.md)). Cutting a tag is safe.
- Merging a release PR may itself open a fresh Release PR for subsequent commits — that's normal.

## Database migrations (dev)
- Forward-only files in `supabase/migrations/`. Adding a **new** migration file + pushing to `master` makes `deploy-dev` apply it to `nzx-dev`.
- Follow the strict **expand-contract** policy in [CLAUDE.md](../CLAUDE.md) (never drop/rename a column in the release that stops using it). New nullable columns / new tables / new indexes are single-release-safe.
- New finance table checklist: (a) table, (b) `updated_at` touch trigger, (c) `enable row level security`, (d) owner-only policy on `profile_id = auth.uid()`.

## Verifying UI changes
Per the user's standing request, **verify visual/UI changes with Playwright** before committing: start `npx pnpm@9.12.3 dev`, then use the Playwright MCP (`browser_navigate` → `browser_snapshot` / `browser_take_screenshot`, `browser_click` to exercise interactions). Clean up screenshot artifacts (`*.png`, `.playwright-mcp/`) before committing — don't commit them.
