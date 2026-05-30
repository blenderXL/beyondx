# Progress Tracker

> **Living doc.** What's done, in-flight, and next. Update as work lands. Ship order / scope source of truth is [CLAUDE.md](../CLAUDE.md); this is the running status against it.

_Last updated: 2026-05-29._

## Milestone status
- **v1.0 — SHIPPED & TAGGED `v0.1.1`.** Landing + auth + signed-in shell + forward-compatible schema. Full CI/CD pipeline live and validated end-to-end.
- **v1.1 — NOT STARTED (next).** Real CRUD + calculator + paywall.
- **v1.2 — future.** LLM assistant (Pro-gated).

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
- **PR #4** — `feat(landing): remove day/night arrow callout from hero`. Open, CI/preview running. Verified locally with Playwright (callout gone; centerpiece/toggle/nav/clock intact; theme toggle still swaps). **Awaiting review/merge.**
- **PR (this) — `docs/project-knowledge`** — adds `docs/` (PROJECT-STATE, DEV-WORKFLOW, PRODUCTION-PLAN, PROGRESS) + CLAUDE.md pointer.

## ▶️ Next: v1.1 backlog (from CLAUDE.md)
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
- **2026-05-29** — Production deferred to ~post-v1.1 (no users/domain). Repo made **public** (Hobby requirement; scanned clean). Pinned Next.js **15.1.11** (CVE block). release-please uses **`RELEASE_PLEASE_TOKEN`** PAT (org locks `GITHUB_TOKEN`). No WAF/bot protection for v1.0 (benign bot traffic; revisit at v1.2). Speed Insights/Analytics deferred to v1.1. Landing aesthetic kept; removed only the day/night arrow callout.
- Vercel stays **Hobby** until v1.1 launch (then Pro). "master = Preview only" trick is dead; master auto-deploys to Vercel Production (dev Supabase) — harmless pre-launch.
