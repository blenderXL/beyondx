# Progress Tracker

> **Living doc.** What's done, in-flight, and next. Update as work lands. Ship order / scope source of truth is [CLAUDE.md](../CLAUDE.md); this is the running status against it.

_Last updated: 2026-05-31._

## Milestone status
- **v1.0 — SHIPPED & TAGGED `v0.1.1`.** Landing + auth + signed-in shell + forward-compatible schema. Full CI/CD pipeline live and validated end-to-end.
- **v1.1 — IN PROGRESS.** Auth hardening (email+password + TOTP MFA) **shipped, merged to master, released `v0.1.2`, and deployed to the Vercel Production target.** Remaining: CRUD + calculator + paywall.
- **v1.2 — future.** LLM assistant (Pro-gated).

## ✅ Done (v1.1)
- **Secure email+password auth + TOTP MFA** (branch `feat/auth-email-password-mfa`):
  - Login/signup reworked to email+password via **Server Actions** (`app/(auth)/actions.ts`) — generic non-enumerating errors, server-side password policy (`lib/auth/passwordPolicy.ts`, min 10 + char classes). Magic-link removed; Google OAuth + disabled Apple stub kept. Password reset added (`/forgot-password`, `/reset-password`).
  - **TOTP MFA** opt-in at Account → Security (`/app/settings/security`, `MfaManager`); login step-up at `/login/verify` (`MfaChallenge`); `middleware.ts` enforces AAL2 on `/app/*` once a factor is verified (loop-safe — challenge lives outside `/app`).
  - **Tests:** `tests/unit/passwordPolicy.test.ts`; e2e `auth.spec` (updated), `auth-password.spec`, `mfa.spec` (full enroll→step-up→middleware, self-cleaning, pinned to one project). Seed script `scripts/seed-test-user.ts` + `tests/e2e/helpers/auth.ts` (TOTP via `otpauth`). All green; verified live with Playwright against nzx-dev.
  - **Test creds are env-only** (`TEST_USER_*`/`TEST_MFA_USER_*` in `.env.local`; never committed). Specs skip when unset. CI references the matching secrets — add them to run auth E2E in CI (see PROJECT-STATE GitHub secrets).
  - **Fixed** local `.env.local` (URL+anon+service_role were all pointing at the dead `zoyl` project → now `nzx-dev`; service_role key now set).
  - **Merged** PR #7 (auth) + PR #4 (landing callout) + PR #6 (release) → **`v0.1.2`** tagged + GitHub Release; Vercel Production redeployed (prod Supabase untouched — `deploy-prod` is manual-only).

## ✅ Done (v1.0)
- Scaffold (commit `5078d87`): landing (hle.io-style: mono nav, terminal taglines, gradient floor, day/night toggle, SVG centerpiece with payoff curve, live clock), auth (login/signup/callback), signed-in shell `(app)/app/*`, finance schema `0001`/`0002` with RLS.
- Route groups: `(marketing)` public, `(auth)`, `(app)` behind `middleware.ts` auth gate. Entitlements via `getEntitlements()` (v1.0 returns `tier: 'free'`). LLM is an interface only (`lib/llm/provider.ts`). Theme is CSS-var driven.
- **CI/CD pipeline** (validated): branch→PR→CI(`Lint · typecheck · unit` + `E2E`)→Vercel preview→merge→`deploy-dev`(migrations)→`release-please`(Release PR)→tag/Release. Vercel auto-deploys master→Production target.
- **Infra saga resolved** (see Decision log): repo public, Supabase ledgers repaired on dev+prod, branch ruleset armed with the 2 real checks, GitHub repo secrets set, Vercel env vars set.

## 🔧 Resolved blockers (this arc)
| Blocker | Fix | Commit/PR |
|---|---|---|
| CI: pnpm "Multiple versions" in `action-setup` | read version from `package.json#packageManager` only | `60401e3` |
| Vercel deploy ERROR (build OK) | Vercel hard-blocks Next.js CVE-2025-66478 (RCE) + Dec-25 follow-ups → bump `next`+`eslint-config-next` `15.1.3 → 15.1.11` | `a78c56f` (PR #1) |
| Branch ruleset had 4 phantom check names | re-armed with the 2 real checks | (settings) |
| release-please: "Actions not permitted to create PRs" (org locks `GITHUB_TOKEN`) | authenticate with scoped PAT `RELEASE_PLEASE_TOKEN` | `48d7738` (PR #2) |
| Release not cut | merged Release PR #3 → tag `v0.1.1` + GitHub Release | PR #3 |

## 🟡 In flight
- **Nothing open.** All PRs merged (#4, #6, #7); no open branches. `master` is at `v0.1.2`.

## ▶️ Next: v1.1 backlog (from CLAUDE.md)
0. ~~Auth hardening (email+password + MFA)~~ — **done & released (v0.1.2)**. Remaining optional follow-ups: configure **Google OAuth** on nzx-dev (currently `external.google: false`; parked) and **Apple** (parked); add the **5 CI secrets** so auth E2E runs in CI (currently skips); optional **security-advisor hardening migration** (SECURITY DEFINER RPC revoke, `search_path`).
1. **Debt CRUD** — entry form + list, RLS-backed persistence (recommended first; everything downstream needs debts in the table).
2. Income / expense CRUD.
3. **Snowball / avalanche calculator** — deterministic month-by-month math.
4. Schedule UI + charts.
5. **Lemon Squeezy paywall** — `getEntitlements()` reads `profiles.tier` + `subscription_status` + `current_period_end`; `SUPABASE_SERVICE_ROLE_KEY` for webhooks.
6. Add `@vercel/speed-insights` + `@vercel/analytics` (trivial; defer until there's traffic).
7. Migrate Supabase legacy keys → `sb_publishable_`/`sb_secret_` (bump `@supabase/ssr`).

## v1.2 (later)
- LLM assistant: Claude Haiku 4.5 via Vercel AI SDK first (provider swappable via `lib/llm/provider.ts`), Pro-gated, per-user rate-limited.

## Decision log (key, dated)
- **2026-05-31** — Shipped auth: merged PR #7 + #4 + release PR #6 → **`v0.1.2`** (pre-1.0 so two `feat`s = patch bump per release-please default). **Test credentials moved to env-only** (removed hardcoded defaults from seed script + e2e helper; values live only in gitignored `.env.local`; CI reads matching secrets; specs skip if unset) — per the rule "no test creds in git". Google OAuth + Apple **parked**. Prod deploy still manual-only (not run).
- **2026-05-30** — Auth: **email+password** (magic-link parked), **server-action-first** for no-enumeration + secure cookies, **password reset in scope**, **TOTP MFA opt-in + enforced when enabled** (mandatory MFA deferred). **HIBP leaked-password protection deferred to prod** (Pro-only; nzx-dev is Free). Test users seeded via service-role admin API; deterministic TOTP in E2E via enroll-then-capture. Discovered + fixed local `.env.local` pointing at the dead `zoyl` project.
- **2026-05-29** — Production deferred to ~post-v1.1 (no users/domain). Repo made **public** (Hobby requirement; scanned clean). Pinned Next.js **15.1.11** (CVE block). release-please uses **`RELEASE_PLEASE_TOKEN`** PAT (org locks `GITHUB_TOKEN`). No WAF/bot protection for v1.0 (benign bot traffic; revisit at v1.2). Speed Insights/Analytics deferred to v1.1. Landing aesthetic kept; removed only the day/night arrow callout.
- Vercel stays **Hobby** until v1.1 launch (then Pro). "master = Preview only" trick is dead; master auto-deploys to Vercel Production (dev Supabase) — harmless pre-launch.
