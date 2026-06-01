# Project State — infrastructure & wiring

> **Living doc.** Update whenever infra/wiring changes. Sister docs: [DEV-WORKFLOW.md](./DEV-WORKFLOW.md), [PRODUCTION-PLAN.md](./PRODUCTION-PLAN.md), [PROGRESS.md](./PROGRESS.md). Architecture/stack/migration-policy live in the root [CLAUDE.md](../CLAUDE.md); first-time external setup steps live in [SETUP.md](../SETUP.md). This file is the **inventory of what currently exists and where**.

_Last updated: 2026-06-01 (Phase 1 debt management merged, PR #10; awaiting release v0.1.3)._

## Identity / app
- **App:** NZX — personal debt-payoff / budgeting planner (`package.json` name is `nzx`; org/repo is `beyondx`). Target domain `nzxus.com` (DNS not pointed yet).
- **Current version:** `0.1.2` (tag `v0.1.2` is the latest cut). **`package.json` still reads `0.1.2`** — debt management is merged to master but unreleased; it lands as **`v0.1.3`** when the open Release PR #9 is merged.
- **Milestone:** v1.0 shipped; **v1.1 in progress** — real auth (email+password + TOTP MFA) shipped & released; **Phase 1 debt management (CRUD + transactions) merged to master**. Remaining: income/expense/savings CRUD + calculator + paywall. See [PROGRESS.md](./PROGRESS.md).

## GitHub
- **Repo:** `blenderXL/beyondx` — **PUBLIC** (Vercel Hobby can't deploy a private *org* repo; git history was secret-scanned clean + RLS confirmed before going public).
- **Default branch:** `master`. Trunk-based: feature branch → PR → merge.
- **Branch protection ruleset `master-protection`** (Active): requires a PR + 2 status checks: **`Lint · typecheck · unit`** and **`E2E (Playwright against local dev)`**. Block force pushes. (Required approvals = 0, solo dev.)
- **Org `blenderXL` policy (important):** locks `GITHUB_TOKEN` to **read-only** and **disables Actions-created PRs** (repo-level toggle is grayed out / org-enforced). Org also requires approval before first-time contributors' workflows run. Consequence → see `RELEASE_PLEASE_TOKEN` below.
- **⚠️ `gh` CLI limitation:** the local `gh` PAT can **read** (runs, checks, api) but **cannot create or merge PRs** (`Resource not accessible by personal access token`). **Use the GitHub MCP tools** (`mcp__plugin_github_github__create_pull_request` / `merge_pull_request`) for those. Documented in memory too.

### GitHub secrets
**Repository secrets (set):**
| Secret | Purpose |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | CLI auth for `supabase db push` (dev workflow) |
| `SUPABASE_DEV_URL` · `SUPABASE_DEV_ANON_KEY` | E2E env in CI |
| `SUPABASE_DEV_PROJECT_REF` · `SUPABASE_DEV_DB_PASSWORD` | `deploy-dev` migrations |
| `RELEASE_PLEASE_TOKEN` | fine-grained PAT (Contents + Pull requests: write on `beyondx`) so release-please can open the Release PR despite the org `GITHUB_TOKEN` lockdown |

**Repository secrets — NOT YET SET (auth E2E in CI):** `SUPABASE_DEV_SERVICE_ROLE_KEY`, `TEST_USER_EMAIL`, `TEST_USER_PASSWORD`, `TEST_MFA_USER_EMAIL`, `TEST_MFA_USER_PASSWORD`. `.github/workflows/ci.yml` already references them; until they're added, the auth/MFA E2E specs **skip** in CI (CI still green). Add them to run the full auth flow in CI. Values are the same ones in local `.env.local`.

**`production` environment secrets — DEFERRED (not set):** `SUPABASE_PROD_PROJECT_REF`, `SUPABASE_PROD_DB_PASSWORD`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`. See [PRODUCTION-PLAN.md](./PRODUCTION-PLAN.md).

## Supabase
- **dev — `nzx-dev`**, ref **`mlbskwkjwbdewbmoagav`**, region East US. Touched by local dev + Vercel previews + CI + `deploy-dev`. Migrations `0001`,`0002`,`0003` applied; **ledger repaired** (`supabase migration repair --status applied 0001 0002`) because manual SQL-Editor application doesn't write `supabase_migrations.schema_migrations` and `0001`/`0002` aren't idempotent. **`0003` (debts + transactions)** was applied via MCP `apply_migration`, which wrote a **timestamp** version that mismatched `deploy-dev`'s `db push` — reconciled by hand (see memory `supabase-mcp-migration-version-mismatch.md`); next push is clean. **Local CLI is linked to dev** (safe — avoids accidental prod pushes; `supabase/.temp/project-ref` = `mlbskwkjwbdewbmoagav`).
- **prod — `nzx-prod`**, ref **`jdhfhibxdvdhleooetld`**. Ledger also repaired. **No app/deploy wired to it yet** (prod deferred).
- **Stray project `zoylwebniuxntcmrbmhb`** ("BeyondX Project", Ohio, INACTIVE) — an unused early test. Local `.env.local` had been pointing at this dead project (all three Supabase vars), so local dev couldn't reach Supabase. **Fixed 2026-05-30/31:** all three (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) now point at `nzx-dev`. Delete the stray project when convenient.
- **Keys:** using **legacy** `anon`/`service_role` JWT keys (the `@supabase/ssr@0.5.2` in use predates `sb_publishable_`/`sb_secret_`; migrating to new keys is a v1.1 chore). The `nzx-dev` `SUPABASE_SERVICE_ROLE_KEY` is now set correctly in `.env.local` — used by `pnpm seed:test-user`, the MFA E2E cleanup helper, and (future) Lemon Squeezy webhooks; the app itself runs on URL + anon. Get/rotate it at Dashboard → Project Settings → API.
- **Auth (v1.1):** email + **password** (`signInWithPassword`/`signUp`) + Google OAuth + disabled Apple stub. **TOTP MFA** is opt-in (Account → Security) and enforced at login (AAL2 step-up) once a factor is verified — middleware bounces AAL1 sessions with a factor to `/login/verify`. nzx-dev GoTrue settings (from `/auth/v1/settings`): `mailer_autoconfirm: false` (email confirmation **on**), `disable_signup: false`. **⚠️ `external.google: false` — Google OAuth is NOT configured on nzx-dev** (needs Client ID/secret in the dashboard + Google Cloud creds); the button errors until then. **Leaked-password protection (HIBP)** unavailable on Free — deferred to prod (Pro). Password policy (min length 10 + char classes) is enforced in-app (`lib/auth/passwordPolicy.ts`); set it dashboard-side too for defense-in-depth.
- **Dev test users (nzx-dev only):** two seeded, email-confirmed users — a password-login user and an MFA user. **Credentials are env-only and never committed:** set `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` / `TEST_MFA_USER_EMAIL` / `TEST_MFA_USER_PASSWORD` in `.env.local` (template in `.env.local.example`), then `npx pnpm@9.12.3 seed:test-user` (uses the service_role key; idempotent). The auth/MFA E2E specs **skip** when these env vars are unset. The actual values live only in `.env.local` (gitignored) — not in any doc or tracked file.
- **RLS:** enabled on all 8 finance tables (`profiles`, `debts`, `accounts`, `incomes`, `expenses`, `plans`, `plan_runs`, **`transactions`**), owner-only policies keyed on `profile_id = auth.uid()`. `transactions` is append-only (no `updated_at`), with indexes on `profile_id` and `debt_id`; `expense_id`/`savings_goal_id` columns exist nullable now but their FKs land in Phase 2 when those tables get UIs.
- **Security advisors (pre-existing, not from auth work):** `handle_new_user()` + `rls_auto_enable()` are `SECURITY DEFINER` and callable via `/rest/v1/rpc/` by anon/authenticated; `touch_updated_at` has a mutable `search_path`; `vector` extension lives in `public`. Candidates for a small hardening migration (`revoke execute … from anon, authenticated`, `set search_path`).
- **Planned (not built — Phase 1.6):** a **`feature_flags`** table (`key pk, enabled, rollout_pct, audience, updated_at`) as the interim runtime backend for release flags — flipped from the dashboard/SQL at release sign-off (no redeploy), later superseded by PostHog flags (Track B · B2).

## Planned architecture seams (not yet built — Phase 1.6)
Two-gate feature gating (full design in the roadmap plan file `~/.claude/plans/let-me-first-ask-hidden-pebble.md`):
- **Release flags:** `lib/flags/registry.ts` (the modular flag list) + `lib/flags/provider.ts` (`FlagProvider` interface, mirrors `lib/llm/provider.ts`) + interim Supabase `feature_flags` provider + `<FeatureGate flag="…">` (mirrors `components/entitlements/RequireTier.tsx`). Default-off fail-safe.
- **Entitlements:** reuse `lib/entitlements/getEntitlements.ts`; extract its inline `features` map into a separate `lib/entitlements/featureAccess.ts` (feature → min tier). Composed with release flags into a `{ visible, locked }` helper.

## Vercel
- **Project:** `beyondx`, id **`prj_PjkU0IjQEgZjlcKTyIZG2SbJMMcQ`**. **Team:** "Ankit P's projects", id **`team_tZgnGRBMi9kCYlOyVufpXZ9D`**. **Plan: Hobby (free).** Framework `nextjs`, **Node 24.x** (builds fine; CI/app target Node 20 — mismatch is non-blocking).
- **Production target URL:** `beyondx-pied.vercel.app` (aliases: `beyondx-ankit-p-s-projects.vercel.app`, `beyondx-git-master-...`). Per-commit previews are `beyondx-<hash>-ankit-p-s-projects.vercel.app`.
- **⚠️ master auto-deploys to Vercel's Production target** — the "master = Preview only" placeholder trick is dead (new Vercel UI validates the branch). So merges to `master` publish to `beyondx-pied.vercel.app`, currently pointed at **DEV Supabase** (Production env vars hold dev values). Harmless now (no real domain/users; `nzx-prod` untouched — the GitHub `deploy-prod` workflow has never run). Swap at launch (see [PRODUCTION-PLAN.md](./PRODUCTION-PLAN.md)).
- **Env vars** (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`): **dev values** on **Production + Preview + Development**. (Anon key is public-by-design; RLS protects data.) `SUPABASE_SERVICE_ROLE_KEY` intentionally absent.
- **Deployment Protection "Require Log In":** ON (per prior session) — must be turned **OFF before public launch** or the landing page is login-walled.
- **Git Fork Protection:** ON by default (fork PRs need authorization before building). Even off, secrets are safe (fork builds only get Preview/dev env, never prod or `VERCEL_TOKEN`).
- **Firewall:** automatic DDoS mitigation only (always on). No custom WAF rules / Bot Management — **intentional for v1.0**. Background bot/crawler traffic on the public `*.vercel.app` URLs is expected and benign. Revisit rate-limiting at v1.2 for the LLM assistant (the real cost-abuse surface).

## Local dev environment
- **`pnpm` is NOT on PATH**, no corepack → use **`npx pnpm@9.12.3 <cmd>`** for everything (install, dev, build, typecheck, test). `packageManager` is pinned `pnpm@9.12.3`.
- Machine Node is v25.x; project/CI target Node 20.
- `.env.local` is present and gitignored. Required for the app to boot (middleware refreshes the Supabase session on every request). **URL + anon now point at `nzx-dev`** (were stale `zoyl` — see Supabase note); the `SUPABASE_SERVICE_ROLE_KEY` line is still stale and needs the real `nzx-dev` secret for `seed:test-user`. The Playwright runner also reads `.env.local` (loaded in `playwright.config.ts`) for MFA-cleanup helpers.
- **Playwright browsers** must be installed once: `npx pnpm@9.12.3 exec playwright install chromium`.
- **Next.js pinned to `15.1.11`** (and `eslint-config-next` in lockstep) — do not downgrade. Vercel hard-blocks deploys on Next versions vulnerable to CVE-2025-66478 (RCE) and the Dec-2025 follow-ups; 15.1.11 is the patched 15.1.x release.

## Tooling notes for the agent
- MCP servers connected: GitHub, Supabase, Vercel, Playwright, context-mode, claude-mem. Schemas are deferred — load via ToolSearch `select:<name>`.
- Project memory at `~/.claude/projects/.../memory/` (e.g. `gh-pr-ops-need-mcp.md`).
