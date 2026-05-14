# NZX

A personal debt-payoff and budgeting planner. Manual entry, deterministic
snowball/avalanche math, optional AI assistant behind a Pro subscription.

**Domain:** [nzxus.com](https://nzxus.com) (planned)

## Stack

- Next.js 15 (App Router) + TypeScript strict + React 19
- Tailwind v4 (dark-first theme)
- Framer Motion (landing animations)
- Supabase (Postgres + Auth + RLS + pgvector)
- Lemon Squeezy (billing, wired in v1.1)
- Provider-agnostic LLM interface (real provider lands in v1.2)
- Vercel (hosting)
- Playwright + Vitest (testing)

## Getting started

```bash
pnpm install
cp .env.local.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY at minimum
pnpm dev
```

Visit <http://localhost:3000>.

## Useful commands

| | |
|---|---|
| `pnpm dev` | Dev server |
| `pnpm build` | Production build |
| `pnpm typecheck` | TypeScript |
| `pnpm lint` | ESLint |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm test:e2e` | E2E tests (Playwright) |
| `pnpm format` | Prettier |

## Ship plan

- **v1.0** (this version) — landing + auth + signed-in shell + Supabase schema
- **v1.1** — Debt/income/expense CRUD, snowball/avalanche calculator, schedule, charts, Lemon Squeezy paywall
- **v1.2** — LLM assistant gated to Pro

See `CLAUDE.md` for architecture notes and the active SDLC details.

## Releases

Releases are tag-driven. The flow:

1. PRs merge to `master` → auto-deploy to dev (Vercel Preview + dev Supabase).
2. [release-please](https://github.com/googleapis/release-please) maintains an open "Release PR" against `master` that bumps the version and writes `CHANGELOG.md`.
3. Merging the Release PR cuts a semver tag (`vX.Y.Z`) and publishes a GitHub Release.
4. The release triggers `deploy-prod`, which pauses for manual approval, then applies migrations to prod Supabase and promotes the build to Vercel production.
5. Rollback: Vercel → Deployments → previous deployment → **Promote to Production**.

Migrations follow strict expand-contract — see `CLAUDE.md` for the rules.

## License

Not yet licensed; all rights reserved by the author.
