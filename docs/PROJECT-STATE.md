# Project State — infrastructure & wiring

> **Living doc.** Update whenever infra/wiring changes. Sister docs: [DEV-WORKFLOW.md](./DEV-WORKFLOW.md), [PRODUCTION-PLAN.md](./PRODUCTION-PLAN.md), [PROGRESS.md](./PROGRESS.md). Architecture/stack/migration-policy live in the root [CLAUDE.md](../CLAUDE.md); first-time external setup steps live in [SETUP.md](../SETUP.md). This file is the **inventory of what currently exists and where**.

_Last updated: 2026-05-30 (v1.1 auth: email+password + TOTP MFA; fixed stale local Supabase env)._

## Identity / app
- **App:** NZX — personal debt-payoff / budgeting planner (`package.json` name is `nzx`; org/repo is `beyondx`). Target domain `nzxus.com` (DNS not pointed yet).
- **Current version:** `0.1.1` (tag `v0.1.1` cut, GitHub Release published).
- **Milestone:** v1.0 shipped (landing + auth scaffold + signed-in shell + schema). See [PROGRESS.md](./PROGRESS.md).

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

**`production` environment secrets — DEFERRED (not set):** `SUPABASE_PROD_PROJECT_REF`, `SUPABASE_PROD_DB_PASSWORD`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`. See [PRODUCTION-PLAN.md](./PRODUCTION-PLAN.md).

## Supabase
- **dev — `nzx-dev`**, ref **`mlbskwkjwbdewbmoagav`**, region East US. Touched by local dev + Vercel previews + CI + `deploy-dev`. Migrations `0001`,`0002` applied; **ledger repaired** (`supabase migration repair --status applied 0001 0002`) because manual SQL-Editor application doesn't write `supabase_migrations.schema_migrations` and the migrations aren't idempotent. **Local CLI is linked to dev** (safe — avoids accidental prod pushes; `supabase/.temp/project-ref` = `mlbskwkjwbdewbmoagav`).
- **prod — `nzx-prod`**, ref **`jdhfhibxdvdhleooetld`**. Ledger also repaired. **No app/deploy wired to it yet** (prod deferred).
- **Stray project `zoylwebniuxntcmrbmhb`** ("BeyondX Project", Ohio, INACTIVE) — an unused early test. **⚠️ local `.env.local` had been pointing at this dead project** (all three Supabase vars), so local dev couldn't reach Supabase at all. Fixed 2026-05-30: `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` now point at `nzx-dev`. Delete the stray project when convenient.
- **Keys:** using **legacy** `anon`/`service_role` JWT keys (the `@supabase/ssr@0.5.2` in use predates `sb_publishable_`/`sb_secret_`; migrating to new keys is a v1.1 chore). **⚠️ `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` is still the stale `zoyl` key** — replace with the `nzx-dev` service_role secret (Dashboard → Project Settings → API). Needed only by `pnpm seed:test-user` and (future) Lemon Squeezy webhooks; the app itself runs on URL + anon.
- **Auth (v1.1):** email + **password** (`signInWithPassword`/`signUp`) + Google OAuth + disabled Apple stub. **TOTP MFA** is opt-in (Account → Security) and enforced at login (AAL2 step-up) once a factor is verified — middleware bounces AAL1 sessions with a factor to `/login/verify`. nzx-dev GoTrue settings (from `/auth/v1/settings`): `mailer_autoconfirm: false` (email confirmation **on**), `disable_signup: false`. **⚠️ `external.google: false` — Google OAuth is NOT configured on nzx-dev** (needs Client ID/secret in the dashboard + Google Cloud creds); the button errors until then. **Leaked-password protection (HIBP)** unavailable on Free — deferred to prod (Pro). Password policy (min length 10 + char classes) is enforced in-app (`lib/auth/passwordPolicy.ts`); set it dashboard-side too for defense-in-depth.
- **Dev test users (nzx-dev only):** `e2e@nzxus.com` (login/password specs) and `e2e-mfa@nzxus.com` (MFA spec), both email-confirmed. Recreate with `npx pnpm@9.12.3 seed:test-user` (needs the real service_role key) or via GoTrue signup + SQL confirm. Passwords/defaults in `scripts/seed-test-user.ts` ↔ `tests/e2e/helpers/auth.ts`.
- **RLS:** enabled on all 7 finance tables (`profiles`, `debts`, `accounts`, `incomes`, `expenses`, `plans`, `plan_runs`), owner-only policies keyed on `profile_id = auth.uid()`.
- **Security advisors (pre-existing, not from auth work):** `handle_new_user()` + `rls_auto_enable()` are `SECURITY DEFINER` and callable via `/rest/v1/rpc/` by anon/authenticated; `touch_updated_at` has a mutable `search_path`; `vector` extension lives in `public`. Candidates for a small hardening migration (`revoke execute … from anon, authenticated`, `set search_path`).

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
