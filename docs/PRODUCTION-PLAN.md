# Production — future scope & launch checklist

> **Living doc.** Production is **deliberately deferred** (~post-v1.1). Nothing here is wired yet. This is the plan for when NZX gets real users / a domain. Dev/preview flow → [DEV-WORKFLOW.md](./DEV-WORKFLOW.md). Inventory → [PROJECT-STATE.md](./PROJECT-STATE.md).

_Last updated: 2026-05-30._

## Why deferred
v1.0 is a landing-page scaffold — no real CRUD, no payments, no LLM, no users, no domain. There is nothing to gate, so all prod wiring is intentionally skipped until v1.1 brings real functionality. `nzx-prod` Supabase exists (ledger repaired) but no app or workflow touches it.

## How prod deploy is designed to work (already built, never run)
- **`.github/workflows/deploy-prod.yml`** triggers on **`workflow_dispatch` only** — a human clicks **Actions → "Deploy · production" → Run workflow** and supplies the release **tag** (e.g. `v0.1.1`).
- Two stages, both using the GitHub **`production` environment**: (1) `migrate-prod` applies migrations to `nzx-prod`; (2) `deploy-prod` builds + `vercel deploy --prebuilt --prod`.
- **Three isolation layers** keep prod safe from PRs/forks: manual dispatch + `production` environment-scoped secrets + the environment's `v*`-tag-only deployment rule. Prod secrets can never be read by PR jobs.
- **No `release: published` trigger** — cutting a tag/Release does **not** auto-deploy prod. Publishing a release is safe.

## Launch checklist (do these when going to prod)
- [ ] **Set `production` environment secrets** (GitHub → Settings → Environments → production): `SUPABASE_PROD_PROJECT_REF` (`jdhfhibxdvdhleooetld`), `SUPABASE_PROD_DB_PASSWORD`, `VERCEL_TOKEN`, `VERCEL_ORG_ID` (= team id `team_tZgnGRBMi9kCYlOyVufpXZ9D`), `VERCEL_PROJECT_ID` (`prj_PjkU0IjQEgZjlcKTyIZG2SbJMMcQ`).
- [ ] **Create the Vercel token** (`https://vercel.com/account/tokens`, scoped to the team) for `VERCEL_TOKEN`.
- [ ] **Swap Vercel *Production* env vars** `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` from dev → **`nzx-prod`** values (leave Preview/Development on dev).
- [ ] **Turn OFF Vercel Deployment Protection "Require Log In"** (or the public landing is login-walled).
- [ ] **Add `SUPABASE_SERVICE_ROLE_KEY`** (prod) — server-side only, never `NEXT_PUBLIC_`. First needed in v1.1 for Lemon Squeezy webhooks.
- [ ] **Migrate Supabase keys** legacy `anon`/`service_role` → `sb_publishable_`/`sb_secret_` (requires bumping `@supabase/ssr` past 0.5.2). v1.1 chore.
- [ ] **Point `nzxus.com` DNS at Vercel** + add the domain in Vercel.
- [ ] **Upgrade Vercel to Pro ($20/mo)** — Hobby ToS forbids commercial/paid use; required once a paid tier exists.
- [ ] **Dress-rehearse** the full prod path (SETUP.md step 10): merge a Release PR → tag → manually dispatch `Deploy · production` with the tag → verify `nzx-prod` migrations + Vercel prod serve against prod Supabase.
- [ ] **Enable Supabase auth hardening on `nzx-prod`** (Pro): turn ON **leaked-password protection (HIBP)** (deferred from dev — Free can't), set **min password length 10 + required char classes** dashboard-side, confirm **email confirmations ON** and **TOTP MFA enabled**, and add prod redirect URLs (`https://nzxus.com/callback` etc.).
- [ ] **Configure Google OAuth** on the prod project (Client ID/secret from Google Cloud) — also still **unconfigured on `nzx-dev`** (`external.google: false`), so the "Continue with Google" button errors until set up in either project.
- [ ] (Optional) Apply the **security-advisor hardening migration**: `revoke execute` on `handle_new_user()` / `rls_auto_enable()` from `anon`/`authenticated`, set `search_path` on `touch_updated_at`, move `vector` out of `public`.
- [ ] (Optional) Re-evaluate WAF / rate-limiting — relevant once the **v1.2 LLM assistant** (cost-bearing) ships; per-user rate-limit the assistant route.

## Rollback
- Vercel → Deployments → pick the previous prod deployment → **Promote to Production** (~10s).
- Schema is **forward-only + expand-contract**, so an older app build always works against the newer DB — that's what makes rollback safe. Never break this invariant (see migration policy in [CLAUDE.md](../CLAUDE.md)).

## Open housekeeping
- Delete stray Supabase project "BeyondX Project" (`zoylwebniuxntcmrbmhb`, Ohio) — unused early test.
- Reconcile Vercel Node 24.x vs CI/app Node 20 (non-blocking; align if convenient).
