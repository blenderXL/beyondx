# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project context

**NZX** (`nzxus.com`) — a personal debt-payoff / budgeting planner. Manual entry (Undebt.it-style), deterministic snowball/avalanche math, optional AI assistant gated behind a Pro subscription.

**Stack:** Next.js 15 App Router + TypeScript strict, Tailwind v4 (dark-first, semantic accent palette), Framer Motion, Supabase (Postgres + Auth + RLS + pgvector), Lemon Squeezy for billing (v1.1), provider-agnostic LLM interface in `lib/llm/provider.ts` (concrete provider lands in v1.2). Hosted on Vercel.

**Ship order:**
- **v1.0** (current) — landing + auth + signed-in shell + forward-compatible schema. No real CRUD, no payments, no LLM.
- **v1.1** — Debt/income/expense CRUD, snowball/avalanche calculator, schedule UI, charts, Lemon Squeezy paywall.
- **v1.2** — LLM assistant gated to Pro (Claude Haiku 4.5 via Vercel AI SDK first; provider swappable).

## Project docs (read these at session start)

Living docs in `docs/` carry the operational state so it doesn't have to be re-explained each session — **read them before infra/deploy work**:
- **`docs/PROJECT-STATE.md`** — infra inventory: GitHub/Supabase/Vercel IDs, secrets, org policies, local-env gotchas (e.g. `pnpm` not on PATH → `npx pnpm@9.12.3`; `gh` can't create/merge PRs → use GitHub MCP).
- **`docs/DEV-WORKFLOW.md`** — branch→PR→preview→merge→deploy-dev→release-please loop; how Vercel previews work (push, not merge).
- **`docs/PRODUCTION-PLAN.md`** — deferred prod scope + launch checklist.
- **`docs/PROGRESS.md`** — milestone status, resolved blockers, v1.1 backlog, decision log.

`SETUP.md` is the original first-time external-setup checklist (with a Status table). Keep these docs updated as processes change.

## Commands

| Action | Command |
|---|---|
| Dev server | `pnpm dev` (Turbopack on `http://localhost:3000`) |
| Production build | `pnpm build` |
| Production start | `pnpm start` |
| Type-check | `pnpm typecheck` |
| Lint | `pnpm lint` |
| Format | `pnpm format` |
| Unit tests (Vitest) | `pnpm test` · single: `pnpm test path/to/file.test.ts` · watch: `pnpm test:watch` |
| E2E tests (Playwright, auto-starts dev server) | `pnpm test:e2e` · UI mode: `pnpm test:e2e:ui` · single: `pnpm exec playwright test tests/e2e/landing.spec.ts` |
| Apply Supabase migrations | `supabase db push` (with Supabase CLI installed and project linked) |

Env vars in `.env.local` (template in `.env.local.example`). `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are required for the app to boot in any mode that touches auth.

## Architecture: the load-bearing pieces

- **Route groups carve the app into three audiences.** `app/(marketing)/*` is public + indexed (landing, pricing, FAQ, about). `app/(auth)/*` is the login/signup surface. `app/(app)/app/*` is everything behind auth. The shared sidebar/topbar lives only in the `(app)` group's layout.
- **`middleware.ts` is the auth gate.** It calls `updateSupabaseSession` (in `lib/supabase/middleware.ts`) on every request to refresh the session cookie, then redirects unauthenticated traffic away from `/app/*`. Session refresh has to happen in middleware because server components can't always set cookies — the middleware sets them so server components can rely on `getSupabaseServerClient()` returning a current session.
- **`getEntitlements()` (in `lib/entitlements/getEntitlements.ts`) is the single source of truth for what a user can do.** v1.0 returns `tier: 'free'` for everyone. v1.1 reads from `profiles.tier` + `subscription_status` + `current_period_end`. v1.2 also reads `assistant_messages_used_this_period`. **Don't sprinkle `if (tier === 'pro')` checks** — call `getEntitlements()` or wrap UI in `<RequireTier tier='pro'>` (server component in `components/entitlements/RequireTier.tsx`).
- **The LLM is an interface, not a vendor.** `LLMProvider` in `lib/llm/provider.ts` defines `generate` / `streamGenerate`. v1.2 will add a `ClaudeProvider` that conforms; swapping to Gemini/OpenAI later is one config line. Never import an LLM SDK directly from a feature module.
- **Supabase schema enforces ownership via Row-Level Security.** Every table in `supabase/migrations/0002_finance_tables.sql` has a policy that requires `profile_id = auth.uid()`. The `profiles` table is created automatically by a trigger on `auth.users` insert (see `0001_init.sql`). When you add a new finance table, you must add (a) the table, (b) the touch trigger for `updated_at`, (c) RLS enable, (d) an owner-only policy. Forgetting any one of these silently breaks isolation.
- **Theme is CSS-driven, not Tailwind-config-driven.** Tokens live in `app/globals.css` under `@theme { ... }`, with a `.theme-light` class override for light mode. `ThemeProvider` (`components/theme/ThemeProvider.tsx`) toggles the class on `<html>` and persists to `localStorage`. Components reference CSS variables (`var(--color-text-primary)`) rather than Tailwind utility colors — this is what makes the day/night swap instant and isolated.
- **Brand vocabulary on the landing** mimics hle.io: monospace nav with dotted bullets, terminal `// comment` taglines, gradient floor with hairline horizon, day/night toggle with curved-arrow callout, live clock bottom-right. No WebGL — the centerpiece is a deliberate SVG (`CenterpieceSvg`) with an animated payoff curve.

## Environments & releases

Two Supabase projects, two Vercel deploy targets, one git branch.

| Layer | Dev | Prod |
|---|---|---|
| Supabase | `nzx-dev` (touched by local + Vercel previews + CI) | `nzx-prod` (touched only by the `deploy-prod` workflow on tag publish) |
| Vercel target | Preview (auto-deploys every push) | Production (deployed only via `vercel deploy --prebuilt --prod` from `deploy-prod`) |
| Public URL | `nzx-xxx.vercel.app` per commit | `nzx-prod.vercel.app` for now; `nzxus.com` at launch |
| Migrations applied by | `deploy-dev` on `push` to `master` | `deploy-prod` on `release: published`, gated by `production` environment approval |

**Releases use trunk-based git + tag promotion:**

1. Work in feature branches → PR → CI green → merge to `master`.
2. `master` push: `deploy-dev` applies migrations to `nzx-dev`; Vercel auto-deploys a Preview build.
3. `release-please` (in `.github/workflows/release-please.yml`) tracks unreleased commits and maintains a long-lived "Release PR" against `master` that bumps the version in `package.json` + `.release-please-manifest.json` and writes `CHANGELOG.md`.
4. When you want to ship, **merge the Release PR**. release-please cuts tag `v<X.Y.Z>` and publishes a GitHub Release.
5. `deploy-prod` triggers on the release, **pauses for manual approval** (GitHub Actions `production` environment), then applies migrations to `nzx-prod` and runs `vercel deploy --prebuilt --prod`.
6. **Rollback** = open Vercel → Deployments → click the previous deployment → "Promote to Production". Schema cannot regress (forward-only migrations), so the migration policy below is what makes this safe.

**Commit message convention:** Conventional Commits, soft — `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `perf:`, `test:`, `ci:`, `build:`. release-please reads these to compute the version bump and changelog. You can always override the version in the open Release PR before merging.

**Env var matrix:**

| Variable | Local `.env.local` | Vercel Preview | Vercel Production |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | dev | dev | prod |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | dev | dev | prod |
| `SUPABASE_SERVICE_ROLE_KEY` | dev | dev | prod |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | auto-filled by Vercel | `https://nzx-prod.vercel.app` (then `nzxus.com`) |

GitHub Actions secrets are documented in `.github/workflows/deploy-*.yml`. Production-tier secrets (`SUPABASE_PROD_*`) are scoped to the `production` environment in GitHub settings, so PR jobs can never read them.

## Migration policy — strict expand-contract

Forward-only migrations live in `supabase/migrations/`. The hard rule: **never drop or rename a column in the same release that stops using it.** Schema changes must remain backward-compatible with the previous app version so a Vercel rollback always works against the current DB.

Renaming `profiles.foo` → `profiles.bar` takes three releases:

1. **Expand** — add `bar`. Write to both `foo` and `bar` from the app. Read from `foo`.
2. **Switch** — backfill `bar` from `foo` (one-off migration). App reads from `bar`. Keep writing both.
3. **Contract** — stop writing `foo`. One release later, drop `foo`.

Same shape for column type changes, NOT NULL additions, FK changes, enum value removals. Adding nullable columns, adding indexes, or adding entirely new tables is always single-release-safe.

## What this repo deliberately does NOT include yet

Don't add these in v1.0 work — they belong to the named later wave:

- Bank/Plaid integration (deferred indefinitely; schema accepts it later)
- Real debt/income/expense CRUD or charts (v1.1)
- Any payment integration code (v1.1)
- Any LLM SDK or assistant logic (v1.2)
- i18n / multi-currency (single USD in v1.x — `numeric(14,2)` columns)
- Pointing `nzxus.com` DNS at Vercel (deferred until v1.1/v1.2 launch)
- A staging Supabase project (dev is staging until real users exist)
- Sentry / error tracking, feature flags (LaunchDarkly / GrowthBook), backups beyond Supabase defaults

---

Behavioral guidelines to reduce common LLM coding mistakes, integrated with the **WAT framework** (Workflows, Agents, Tools). This architecture separates concerns so that probabilistic AI handles reasoning while deterministic code handles execution. That separation is what makes this system reliable. 
**Andrej Karapathy principles have strong priority.** Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don’t assume. Don’t hide confusion. Surface tradeoffs.**

Before implementing anything:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them clearly — never pick silently.
- If a simpler approach exists, say so and recommend it.
- If something is unclear, stop and name what’s confusing. Ask for clarification.

## 2. Simplicity First

**Minimum viable code that solves the problem. Nothing speculative.**

- Implement only what was explicitly asked for.
- Avoid abstractions, flexibility, or configurability unless requested.
- No error handling for impossible or highly unlikely scenarios.
- No premature optimization or “future-proofing”.
- If you write 200 lines when 50 would suffice, rewrite it.

Ask yourself: “Would a senior engineer consider this over-engineered?” If yes, simplify aggressively.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define clear success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, briefly outline the plan with verification steps:
```
1. Step one → verify: [how you’ll check]
2. Step two → verify: [how you’ll check]
``` 

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. Operate within the WAT Framework

You are working inside the **WAT architecture** (Workflows, Agents, Tools). Your primary role is intelligent coordination and decision-making.

**Core operating principles:**
- **Prefer existing tools first**: Before writing new code, always check if a tool already exists in `tools/` that can handle the task.
- **Read the workflow first**: When a task references a workflow in `workflows/`, read it carefully to understand the objective, required inputs, recommended tools, and edge cases.
- **Orchestrate, don’t over-execute**: Use tools for deterministic execution (API calls, file operations, data processing, etc.). Focus on sequencing, decision-making, error recovery, and coordination.
- **Self-improvement loop**: When failures or unexpected behavior occur:
  1. Analyze the root cause.
  2. Fix or improve the tool if needed.
  3. Verify the fix.
  4. Update the relevant workflow with the learned insight (only after user confirmation).

**Important constraints:**
- Do not create or overwrite workflows without explicit permission.
- Maintain surgical changes and simplicity even when working inside the WAT system.
- Temporary files belong in `.tmp/`. Final deliverables should go to cloud services where the user can access them directly.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.