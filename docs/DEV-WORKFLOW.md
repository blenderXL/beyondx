# Dev Workflow — iterate, preview, deploy, release

> **Living doc.** How day-to-day development flows from a local edit to a dev/preview deploy to a cut release. Production is separate → [PRODUCTION-PLAN.md](./PRODUCTION-PLAN.md). Infra inventory → [PROJECT-STATE.md](./PROJECT-STATE.md).

_Last updated: 2026-05-29._

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
| E2E (Playwright) | `npx pnpm@9.12.3 test:e2e` |
| Install after dep change | `npx pnpm@9.12.3 install` (regenerates `pnpm-lock.yaml`) |

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
- **`Deploy · dev`** (`.github/workflows/deploy-dev.yml`): runs `supabase db push` against `nzx-dev`. Currently a **no-op** (ledger repaired; both migrations already applied). It applies any *new* migration files you add.
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
