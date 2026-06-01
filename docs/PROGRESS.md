# Progress Tracker

> **Living doc.** What's done, in-flight, and next. Update as work lands. Ship order / scope source of truth is [CLAUDE.md](../CLAUDE.md); this is the running status against it.

_Last updated: 2026-06-01._

## Milestone status
- **v1.0 — SHIPPED & TAGGED `v0.1.1`.** Landing + auth + signed-in shell + forward-compatible schema. Full CI/CD pipeline live and validated end-to-end.
- **v1.1 — IN PROGRESS.** Auth hardening (email+password + TOTP MFA) **shipped, released `v0.1.2`, deployed to the Vercel Production target.** **Phase 1 — Debt management (CRUD + transactions, migration `0003`) merged to master (PR #10)**, awaiting release as **`v0.1.3`** (sits in the open Release PR). Remaining: Income/Expense/Savings CRUD + calculator + paywall.
- **v1.2 — future.** LLM assistant (Pro-gated).

## Product vision & roadmap (2026-06-01, re-envisioned)
The full roadmap lives in the plan file `~/.claude/plans/let-me-first-ask-hidden-pebble.md` (read it first). NZX is a **both/and**: a month-centric planning cockpit AND a debt-payoff engine AND (later) an AI credit-counselor, on one ledger spine. undebt.it is *reference, not a spec* — we adapt, not clone. The user's spreadsheet is really a **monthly cash-flow plan**, so the planner is promoted up the order.

**Six pillars:** 1) **Ledger spine** (debts ✅ → income+tithe, expenses, savings pots, accounts) → 2) **Monthly planner** (pay-cycle 1st/15th allocation, offerings auto-compute, paid toggles, rollups, budget-left, snapshots) → 3) **Payoff engine** (snowball/avalanche + hybrid/cash-flow-index/highest-interest/custom; method comparison) → 4) **Insights & viz** (timeline, amortization, distributions, utilization, net-worth, per-debt stats) → 5) **Strategy & AI counseling** *(deferred until app is polished)* → 6) **Onboarding & portability** (CSV import/export, **PDF statement smart-import** — LLM extraction, human-in-the-loop, Pro+flagged).

**Phase order:** Phase 1 debts ✅ → **Phase 1.6 flag/entitlement scaffold** (next) → Phase 2 ledger spine cont. → Phase 3 planner → Phase 4 engine → Phase 5 insights → Phase 6 strategy/AI → Phase 7 portability. *(Phase 3-vs-4 ordering is a deliberate open decision.)*

**Track B (cross-cutting):** B1 **Sentry** → B2 **PostHog** (analytics + replay; release flags graduate here) → B3 **feedback / report-an-issue** form. Confirmed stack — **not** Kibana/ELK.

**Two-gate flag/entitlement architecture** *(new — see plan file + PROJECT-STATE):* (A) **release flags** — a modular `lib/flags/registry.ts` list resolved via a `FlagProvider` interface (mirrors `LLMProvider`); interim backend = a Supabase `feature_flags` table flipped from the dashboard at release sign-off (runtime, **no commit/redeploy**); later swaps to PostHog flags. (B) **entitlements** — `getEntitlements()` + a separate `lib/entitlements/featureAccess.ts` tier list. Composed: usable ⇔ release-ON **and** tier-OK → `{ visible, locked }`. Flag-first delivery means Phase 2+ features merge to `master` hidden until signed off.

## ✅ Done (v1.1)
- **Phase 1 — Debt management** (branch `feat/debt-management`, PR #10, merged `96cfa5c`):
  - **Migration `0003_debts_and_transactions.sql`** (idempotent, additive/expand-contract): adds nullable debt fields (`credit_limit`, `original_balance`, `issuer`, `promo_apr`, `promo_until`, `deferred_interest`, `payoff_order`, `notes`) + new **`transactions`** table (`kind` ∈ charge/payment/contribution, append-only, RLS owner-only, indexes on `profile_id`/`debt_id`). Applied to **nzx-dev**; prod untouched.
  - **Finance lib** (`lib/finance/`): `types.ts` (Debt/Transaction), `validation.ts` (money parse/round + server-side checks, reusable for Phase 2), `actionState.ts`. **Server Actions** (`app/(app)/actions.ts`): `createDebt`/`updateDebt`/`archiveDebt` + `addTransaction` (single read-modify-write that adjusts `debts.balance` — charge `+`, payment `−`, **floored at 0**). Balance is the live source of truth.
  - **UI** (`app/(app)/app/debts/page.tsx` + `components/finance/`): `DebtsClient`, `DebtForm`, `TransactionForm`, `formStyles`. Token-styled, responsive (table desktop / cards mobile).
  - **Post-review simplifications** (PR #10): merged two balance fields → single "Current balance" (`original_balance` auto-captured on create as the progress baseline); removed "Payoff order" from the form (nullable DB column kept for a future custom-plan feature); centered native date inputs.
  - **Tests (acceptance gate):** 34 unit tests (validation, balance-adjust/floor, derivations); `tests/e2e/debts.spec.ts` (create→charge→payment-floor→edit→archive, server validation, RLS isolation) desktop + mobile. All green; 31/32 e2e pass (1 known skip: mobile MFA).
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
- **No open feature branches.** Phase 1 (PR #10) merged; branch deleted.
- **Release PR #9 (`chore(master): release 0.1.3`) is OPEN** and now includes debt management. Merging it cuts tag `v0.1.3` + GitHub Release → enables the manual `deploy-prod` dispatch (first real prod ship). User's call.
- **Deferred bookkeeping:** the `deploy-dev` run after the Phase 1 merge showed failed (migration-history reconciliation from an out-of-band MCP `apply_migration` — see memory `supabase-mcp-migration-version-mismatch.md`). DB is reconciled; next `master` push is green. Re-run the failed job in the Actions UI to make it cosmetically green if desired.

## ▶️ Next: v1.1 backlog (from CLAUDE.md)
0. ~~Auth hardening (email+password + MFA)~~ — **done & released (v0.1.2)**. Remaining optional follow-ups: configure **Google OAuth** on nzx-dev (currently `external.google: false`; parked) and **Apple** (parked); add the **5 CI secrets** so auth E2E runs in CI (currently skips); optional **security-advisor hardening migration** (SECURITY DEFINER RPC revoke, `search_path`).
> Superseded by the six-pillar roadmap above; concrete near-term items kept here.

1. ~~**Debt CRUD** — entry form + list, RLS-backed persistence~~ — **done (Phase 1, PR #10)**.
1.6. **Flag + entitlement scaffold** (next, small) — `lib/flags/registry.ts` + `FlagProvider` interface + interim Supabase `feature_flags` table + `<FeatureGate>` + `lib/entitlements/featureAccess.ts` + `{ visible, locked }` helper. Lands before/at the start of Phase 2 so its features merge behind flags.
2. **Income / expense CRUD** (Phase 2) — income + configurable tithe, expenses + group/payee, savings pots, accounts; own additive migration `0004`, reuses Phase 1 patterns (`lib/finance/validation.ts`, the `actions.ts` server-action shape, the `DebtsClient`/`DebtForm` UI idiom). New screens wrapped in `<FeatureGate>`.
3. **Snowball / avalanche calculator** — deterministic month-by-month math.
4. Schedule UI + charts.
5. **Lemon Squeezy paywall** — `getEntitlements()` reads `profiles.tier` + `subscription_status` + `current_period_end`; `SUPABASE_SERVICE_ROLE_KEY` for webhooks.
6. Add `@vercel/speed-insights` + `@vercel/analytics` (trivial; defer until there's traffic).
7. Migrate Supabase legacy keys → `sb_publishable_`/`sb_secret_` (bump `@supabase/ssr`).

## v1.2 (later)
- LLM assistant: Claude Haiku 4.5 via Vercel AI SDK first (provider swappable via `lib/llm/provider.ts`), Pro-gated, per-user rate-limited.

## Decision log (key, dated)
- **2026-06-01 (pm)** — **Roadmap re-envisioned to a one-stop personal-finance platform** (six pillars, month-centric; undebt.it is reference not spec). **Monthly planner promoted** (it's the spreadsheet the user actually replaces). **Two-gate flag/entitlement architecture adopted** — (A) release flags via a modular code registry + `FlagProvider` interface, runtime backend = Supabase `feature_flags` table (flip at release sign-off, **no commit/redeploy**), graduating to PostHog flags; (B) a separate `featureAccess.ts` tier list on top of `getEntitlements()`. Composed → `{ visible, locked }`. **"Feature flags" pulled forward** from CLAUDE.md's deferred list because Phase 2+ merges behind them. **PDF statement smart-import** added to Pillar 6 (LLM extraction, human-in-the-loop, Pro+flagged), deferred with the AI assistant. **Beginning-balance = first-entry** confirmed as intended design (no "highest balance" field). **AI assistant deferred** until the app is polished.
- **2026-06-01** — **Phase 1 (Debt management) built, tested, merged** (PR #10). Key model decisions: **balance is the live source of truth**; transactions (charge/payment) **auto-adjust** it via app-level read-modify-write (floored at 0) — not a DB trigger (kept simple/explicit; trigger deferred). **Everything editable anytime**; `original_balance` auto-captured at create for the progress baseline. **Migration scope narrowed** to debt fields + transactions only (income tithe / expense group / savings pots deferred to Phase 2's `0004` — no speculative schema). Roadmap **reorganized into Track A (core finance) + Track B (platform/growth)**; product framed as **"both/and"** (debt tool AND finance platform), not a pivot. **Track B stack confirmed:** Sentry + PostHog + Vercel log drain (not ELK); a Track B early slice (Sentry + feedback form) pulled forward to right after Phase 1. Mac/Simpli classification resolved at data entry, not schema.
- **2026-05-31** — Shipped auth: merged PR #7 + #4 + release PR #6 → **`v0.1.2`** (pre-1.0 so two `feat`s = patch bump per release-please default). **Test credentials moved to env-only** (removed hardcoded defaults from seed script + e2e helper; values live only in gitignored `.env.local`; CI reads matching secrets; specs skip if unset) — per the rule "no test creds in git". Google OAuth + Apple **parked**. Prod deploy still manual-only (not run).
- **2026-05-30** — Auth: **email+password** (magic-link parked), **server-action-first** for no-enumeration + secure cookies, **password reset in scope**, **TOTP MFA opt-in + enforced when enabled** (mandatory MFA deferred). **HIBP leaked-password protection deferred to prod** (Pro-only; nzx-dev is Free). Test users seeded via service-role admin API; deterministic TOTP in E2E via enroll-then-capture. Discovered + fixed local `.env.local` pointing at the dead `zoyl` project.
- **2026-05-29** — Production deferred to ~post-v1.1 (no users/domain). Repo made **public** (Hobby requirement; scanned clean). Pinned Next.js **15.1.11** (CVE block). release-please uses **`RELEASE_PLEASE_TOKEN`** PAT (org locks `GITHUB_TOKEN`). No WAF/bot protection for v1.0 (benign bot traffic; revisit at v1.2). Speed Insights/Analytics deferred to v1.1. Landing aesthetic kept; removed only the day/night arrow callout.
- Vercel stays **Hobby** until v1.1 launch (then Pro). "master = Preview only" trick is dead; master auto-deploys to Vercel Production (dev Supabase) — harmless pre-launch.
