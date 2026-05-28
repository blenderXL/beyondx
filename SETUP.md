# beyondx — first-time external setup

One-time manual setup before the first `git push`. Work top-to-bottom; each step lists the exact UI clicks and what to paste where. Once done, push `master` and the pipeline runs itself.

**Repo:** `blenderXL/beyondx`
**Local branch:** `master`, 2 commits ahead of origin (unpushed)

---

## Secrets you will collect along the way

Keep a scratch file open (e.g. `~/Desktop/beyondx-secrets.txt` — delete when done). You'll fill these in as you go:

```
# Supabase
SUPABASE_ACCESS_TOKEN=         # step 3
SUPABASE_DEV_PROJECT_REF=      # step 2 (already exists)
SUPABASE_DEV_URL=              # step 2
SUPABASE_DEV_ANON_KEY=         # step 2
SUPABASE_DEV_DB_PASSWORD=      # step 2 (you set this when creating the project)
SUPABASE_PROD_PROJECT_REF=     # step 4
SUPABASE_PROD_DB_PASSWORD=     # step 4 (you set this when creating the project)

# Vercel
VERCEL_TOKEN=                  # step 6
VERCEL_ORG_ID=                 # step 5
VERCEL_PROJECT_ID=             # step 5
```

---

## 1. GitHub repo hardening — `blenderXL/beyondx`

Goal: lock the repo so only reviewed code reaches `master`, and only approved deploys reach prod.

### 1a. Confirm visibility

Open `https://github.com/blenderXL/beyondx` → **Settings** (top-right).

- **General → Danger Zone → Change repository visibility** → should be **Private**. If not, make it private.

### 1b. Branch protection on `master`

Settings → **Rules → Rulesets → New ruleset → New branch ruleset**.

- **Ruleset Name:** `master-protection`
- **Enforcement status:** `Active`
- **Target branches:** Add target → **Include default branch**
- Under **Rules**, enable:
  - ☑ **Require a pull request before merging** (Required approvals: `0` for solo dev — bump later when a teammate joins)
  - ☑ **Require status checks to pass before merging**
    - Click **Add checks** — type and add: `Lint · typecheck · unit` and `E2E (Playwright against local dev)`. (If GitHub says "no matching checks found," skip — they'll register after the first CI run; come back and add them then.)
  - ☑ **Block force pushes**
- Save.

### 1c. Production environment (`production`)

Settings → **Environments → New environment** → name it **exactly** `production` (lowercase — workflow references it by name). *(Already done.)*

- **Required reviewers is NOT available** — that environment protection rule needs GitHub **Enterprise** for private repos (Team/Pro only get it on public repos). We don't use it. The deploy gate is instead a manual `workflow_dispatch` (you click "Run workflow" — see step 10).
- **Deployment branches and tags:** set to **Selected branches and tags** → add a **Tag** rule with pattern `v*`. *(Already done.)*
  - This blocks any non-release ref from ever deploying to `production` — defense-in-depth alongside the manual trigger.

Leave this tab open — we'll come back in step 7 to add `production`-scoped secrets here. (Environment-scoped secrets DO work on Team for private repos — that's the security-critical isolation, and it's intact.)

---

## 2. Supabase **dev** project — `nzx-dev`

If `nzx-dev` already exists from earlier setup, skip to **2c**. Otherwise create it now.

### 2a. Create the project (if missing)

Open `https://supabase.com/dashboard` → **New project**.

- **Organization:** your personal org
- **Name:** `nzx-dev`
- **Database Password:** generate a strong one, paste into your scratch file as `SUPABASE_DEV_DB_PASSWORD`
- **Region:** `us-east-1` (matches `vercel.json` region `iad1`)
- **Pricing Plan:** Free
- Create. Wait ~2 min for provisioning.

### 2b. Apply migrations (first time only)

In the dashboard, open **SQL Editor → New query**. In a separate terminal:

```bash
cat supabase/migrations/0001_init.sql
cat supabase/migrations/0002_finance_tables.sql
```

Paste each file into a new SQL query in the dashboard and Run (in order: `0001`, then `0002`). Confirm no errors.

> Alternatively, if you have the Supabase CLI installed and want to test the migration path locally: `supabase login`, then `supabase link --project-ref <ref>`, then `supabase db push`. Either path works; SQL Editor is simpler for first-time.

### 2c. Grab the dev project secrets

Project dashboard → **Project Settings (gear icon)**:

- **General → Reference ID** → copy to `SUPABASE_DEV_PROJECT_REF` (looks like `abcdefghij`, 20 chars)
- **API → Project URL** → copy to `SUPABASE_DEV_URL` (looks like `https://abcdefghij.supabase.co`)
- **API → Project API keys → `anon` `public`** → copy to `SUPABASE_DEV_ANON_KEY`
- If you forgot the DB password from step 2a: **Database → Database password → Reset** (generates a new one — that's fine).

---

## 3. Supabase personal access token

Used by GitHub Actions to run `supabase db push` against both dev and prod.

- Go to `https://supabase.com/dashboard/account/tokens` → **Generate new token**
- Name: `beyondx-github-actions`
- Copy to scratch file as `SUPABASE_ACCESS_TOKEN`

---

## 4. Supabase **prod** project — `nzx-prod`

Same flow as step 2, with two differences: name is `nzx-prod`, and we do **not** apply migrations manually — the `deploy-prod` workflow does that on the first release.

- Dashboard → **New project**
- Name: `nzx-prod`
- Database Password: generate a different strong one, paste into scratch as `SUPABASE_PROD_DB_PASSWORD`
- Region: `us-east-1`
- Plan: Free (upgrade later when nzxus.com goes live)
- Create. Wait for provisioning.
- Project Settings → **General → Reference ID** → copy to `SUPABASE_PROD_PROJECT_REF`
- **Do not** copy the prod URL/anon key into the GitHub Actions secrets — they go directly into Vercel's production env vars in step 5d.

Also grab these for Vercel prod env vars (step 5d):
- API → Project URL → save as `PROD_SUPABASE_URL`
- API → `anon` `public` → save as `PROD_SUPABASE_ANON_KEY`

---

## 5. Vercel project setup

### 5a. Create the project

`https://vercel.com/new` → **Import Git Repository** → pick `blenderXL/beyondx`.

- **Framework Preset:** Next.js (auto-detected)
- **Root Directory:** `.` (default)
- **Build / Output / Install:** leave defaults — `vercel.json` already declares the right settings
- **Environment Variables:** for now, fill in the **dev** Supabase values (we'll fix prod in 5d):
  - `NEXT_PUBLIC_SUPABASE_URL` = `SUPABASE_DEV_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `SUPABASE_DEV_ANON_KEY`
  - `NEXT_PUBLIC_SITE_URL` = leave blank for now (Vercel auto-injects per-deploy)
- Click **Deploy** — first deploy will likely succeed; if it fails on missing prod env vars, ignore for now, we set them next.

### 5b. Disable auto-production-deploys (CRITICAL)

After import, go to Vercel project → **Settings → Git**:

- **Production Branch:** `master` (default — leave as is)
- **Ignored Build Step:** leave default
- Scroll to **Deploy Hooks** — none needed.

Now → **Settings → Git → Production Branch Behavior**:

- This is the important one. We want master pushes to make **Preview** deploys only — not Production. Find the toggle labeled along the lines of *"Automatically deploy commits to the Production environment when they are pushed to the Production Branch"* and **turn it OFF**.
- (If you can't find that exact toggle: Vercel's current location is **Settings → Git → "Deploy commits to Production from master"** → set to **Off**. UI wording shifts; the goal is "master pushes = Preview only, never Prod".)

> **Why:** `deploy-prod.yml` deploys via the Vercel CLI with `--prod`, triggered manually (`workflow_dispatch`) against a release tag. If Vercel also auto-deploys master to prod, every push goes live without the migration step + manual deploy gate. This is the whole point of the pipeline.

### 5c. Grab Vercel IDs

Vercel project → **Settings → General**:

- **Project ID** → copy to scratch as `VERCEL_PROJECT_ID`

Vercel account → click your avatar → **Account Settings → General** (for personal scope) **or** the team's Settings if you imported under a team:

- **Team ID** (or **Your ID** for personal scope) → copy to scratch as `VERCEL_ORG_ID`

### 5d. Configure Vercel environment variables properly

Project → **Settings → Environment Variables**. You want them split by environment.

| Variable | Production | Preview | Development |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `PROD_SUPABASE_URL` | `SUPABASE_DEV_URL` | `SUPABASE_DEV_URL` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `PROD_SUPABASE_ANON_KEY` | `SUPABASE_DEV_ANON_KEY` | `SUPABASE_DEV_ANON_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY` | (prod service-role key) | (dev service-role key) | (dev service-role key) |
| `NEXT_PUBLIC_SITE_URL` | `https://nzx-prod.vercel.app` | *(leave unset — Vercel auto-injects per-deploy URL)* | `http://localhost:3000` |

For each row: click **Add New**, paste the value, **uncheck the environments you don't want**, save. Repeat. Service-role keys come from Supabase → Project Settings → API → `service_role` `secret` (one per project).

### 5e. Optional: link the local repo to Vercel

If you want `vercel` CLI to work from your laptop for one-off commands:

```bash
pnpm dlx vercel login    # browser auth
pnpm dlx vercel link     # picks up vercel.json
```

Not required for the pipeline — the CI does its own auth via `VERCEL_TOKEN`.

---

## 6. Vercel personal access token

`https://vercel.com/account/tokens` → **Create Token**:

- Name: `beyondx-github-actions`
- Scope: full account (or the team that owns the project)
- Expiration: 1 year (set a calendar reminder to rotate)
- Copy to scratch as `VERCEL_TOKEN`

---

## 7. Wire secrets into GitHub Actions

You'll add secrets in **two places**:
- **Repository secrets** → for things both dev and prod workflows need.
- **`production` environment secrets** → for prod-only secrets, so PR jobs can never read them.

Open `https://github.com/blenderXL/beyondx/settings`.

### 7a. Repository secrets

**Settings → Secrets and variables → Actions → New repository secret** — add each of these:

| Name | Value |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | from step 3 |
| `SUPABASE_DEV_URL` | from step 2c |
| `SUPABASE_DEV_ANON_KEY` | from step 2c |
| `SUPABASE_DEV_PROJECT_REF` | from step 2c |
| `SUPABASE_DEV_DB_PASSWORD` | from step 2a |

### 7b. Production environment secrets

**Settings → Environments → production → Add environment secret** — add each of these:

| Name | Value |
|---|---|
| `SUPABASE_PROD_PROJECT_REF` | from step 4 |
| `SUPABASE_PROD_DB_PASSWORD` | from step 4 |
| `VERCEL_TOKEN` | from step 6 |
| `VERCEL_ORG_ID` | from step 5c |
| `VERCEL_PROJECT_ID` | from step 5c |

> **Why environment-scoped?** A PR from a fork (or a compromised dev secret) can read repository secrets but **not** environment secrets — only workflow jobs that declare `environment: production` can. And the environment's `v*` tag rule means such a job can only run from a release tag, never a PR branch. Combined with the manual `workflow_dispatch` trigger, that's three layers keeping prod secrets out of untrusted runs.

---

## 8. Production-secrets sanity check

Before pushing, confirm none of these leaked into the repo:

```bash
git grep -nE "(supabase\.co|eyJ|sbp_|vercel|sk_live|pk_live)" -- ':!*.md' ':!.env.local.example'
```

Expect: zero matches outside docs. (`.env.local` is gitignored — confirm `cat .gitignore | grep env.local`.)

---

## 9. The first push

When all of the above is done:

```bash
git push -u origin master
```

What happens, in order:

1. **CI workflow** runs (lint · typecheck · unit, then E2E). Should be green.
2. **release-please workflow** opens a **Release PR** titled `chore: release 0.1.1` (or similar) on the same `master`. Don't merge it yet.
3. **deploy-dev workflow** runs `supabase db push` against `nzx-dev`. Logs should say "no migrations to apply" (you applied them manually in step 2b) or apply the two existing files cleanly.
4. **Vercel** auto-deploys a **Preview** build of the commit. Open the project on Vercel → click the deployment → preview URL. Hit `/` and `/login`. Confirm it loads, theme toggle works, signup/login flow works against dev Supabase.

If all four are green → setup is verified.

---

## 10. Dress rehearsal: ship v0.1.1 to prod

Only do this once steps 1–9 are confirmed. This proves the prod path works before you have any real users.

1. Open the **Release PR** that release-please made (`chore: release 0.1.x`). Review the diff — it bumps `package.json`, `.release-please-manifest.json`, and writes `CHANGELOG.md`.
2. **Merge** the Release PR.
3. release-please cuts tag `v0.1.1` and publishes a **GitHub Release**. **Nothing deploys to prod automatically** — the prod workflow is manual.
4. When you're ready to ship, go to **Actions → "Deploy · production" → Run workflow**. A dropdown appears: leave the branch as `master`, enter the tag (`v0.1.1`) in the **"Release tag to deploy"** input → **Run workflow**. *(This manual click is the deploy gate.)*
5. The `migrate-prod` job applies migrations to `nzx-prod`; then `deploy-prod` builds and deploys via Vercel CLI to the production target. (Both jobs use the `production` environment, so they read the prod-scoped secrets.)
6. Visit `nzx-prod.vercel.app` (or whatever Vercel shows under Production). Confirm the page loads against prod Supabase (you should be signed out, since dev/prod don't share users).

### Rollback drill

While you're here, prove rollback works:

1. Vercel project → **Deployments**.
2. Find the prod deployment **before** the latest one (there won't be one yet on the very first release — skip the drill until release 2).
3. After the second prod release: click the older deployment → **⋯ menu → Promote to Production**. Within ~10s, the old build serves prod. Schema didn't change (forward-only + expand-contract), so the older app version still works against the newer schema.

---

## What to tell me when you're done

After step 9 finishes green (don't gate on step 10 — that's once you're ready to cut a real release), reply with:

- ✅ / ❌ for each of steps 1–9
- Any errors you hit (paste exact error + which step)

I'll diagnose anything that fails. The most common first-push gotchas are:
- Vercel still auto-deploys to prod on master push → step 5b toggle missed.
- `deploy-dev` fails on `supabase link` → `SUPABASE_ACCESS_TOKEN` missing or `SUPABASE_DEV_PROJECT_REF` typo.
- CI E2E fails → expected on first run if Playwright browsers cache cold-starts; usually green on retry.
