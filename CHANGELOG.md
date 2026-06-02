# Changelog

## [0.1.5](https://github.com/blenderXL/beyondx/compare/v0.1.4...v0.1.5) (2026-06-02)


### Features

* **insights:** per-type icons in the debt-distribution breakdown ([0ec5785](https://github.com/blenderXL/beyondx/commit/0ec5785795fbc981b311893f53513657f25a1487))
* **insights:** per-type icons in the debt-distribution breakdown ([3b1f5e8](https://github.com/blenderXL/beyondx/commit/3b1f5e8c02e59f8a1c9b6c32ed2266e8c4a00545))

## [0.1.4](https://github.com/blenderXL/beyondx/compare/v0.1.3...v0.1.4) (2026-06-02)


### Features

* **debts:** custom accessible icon-dropdown for the type picker ([7dcc22b](https://github.com/blenderXL/beyondx/commit/7dcc22b72d650d2cf15e0f293ef3d0fccd50adc0))
* **debts:** custom accessible icon-dropdown for the type picker ([9ec5989](https://github.com/blenderXL/beyondx/commit/9ec5989f8b971bb6a1c2643b1ab3cca2f3d53e26))

## [0.1.3](https://github.com/blenderXL/beyondx/compare/v0.1.2...v0.1.3) (2026-06-02)


### Features

* debt management — CRUD, transactions, and payoff fields ([e9ef5ba](https://github.com/blenderXL/beyondx/commit/e9ef5ba54a307804194436f4912d1e0c1cbae661))
* debt management — CRUD, transactions, and payoff fields (Phase 1) ([96cfa5c](https://github.com/blenderXL/beyondx/commit/96cfa5c0f6af0dc3d0477f225553b56af0f12770))
* **debts:** dynamic DebtAccountFormCard + richer types + Next Due Date ([6550f7f](https://github.com/blenderXL/beyondx/commit/6550f7ff1c309b09f1731677199f77ced8f2c7e4))
* **debts:** per-type vector icons, reused across the app ([6e51432](https://github.com/blenderXL/beyondx/commit/6e514327ca7196be2dbbeb493ed3618d2c1245de))
* **finance:** deterministic payoff engine + plans UI (Phase 4) ([096840c](https://github.com/blenderXL/beyondx/commit/096840c01e8da29471f4e73495dc141ec42f1d27))
* **finance:** income+tithe, expenses, savings pots behind flags (Phase 2) ([47319ce](https://github.com/blenderXL/beyondx/commit/47319cefbc73588815caf8bf25b990fe6f550c3e))
* **finance:** insights & visualization with SVG charts (Phase 5) ([cd5fbfb](https://github.com/blenderXL/beyondx/commit/cd5fbfb37611f2f46103f828babe5f2fa94f220a))
* **finance:** monthly planner — the spreadsheet replacement (Phase 3) ([6f563f4](https://github.com/blenderXL/beyondx/commit/6f563f4458717d3ce95654305f7c18e615b72dc9))
* flag system + ledger spine + payoff engine + planner + insights + dynamic debt form ([9b635b2](https://github.com/blenderXL/beyondx/commit/9b635b2ef7896ef06530543b5c2b8c5a2bfbd304))
* **flags:** two-gate feature-flag + entitlement scaffold (Phase 1.6) ([6514fb7](https://github.com/blenderXL/beyondx/commit/6514fb75e9ce3e9ceb174d948ff0063d34baf9db))


### Bug Fixes

* **debts:** move type icon to the form card corner (was overlapping the select) ([c0c21ef](https://github.com/blenderXL/beyondx/commit/c0c21ef39887cddfda57e218c63e0b33088e83fd))
* **debts:** simplify add-debt form per review ([e14993a](https://github.com/blenderXL/beyondx/commit/e14993a03dee4a759479cf21a06383bae9b7e4ed))


### Documentation

* re-envision roadmap to one-stop platform + flag/entitlement architecture ([7ac8925](https://github.com/blenderXL/beyondx/commit/7ac89252c43819f67d0a91f9bc08ce67c0955111))
* record migration 0006 (debt types + next_due_date) ([928dac6](https://github.com/blenderXL/beyondx/commit/928dac6d17511292b86eea70169546228e941efe))
* record Phase 1.6 + Phase 2 as built (flags, migrations 0004/0005, savings) ([23607c4](https://github.com/blenderXL/beyondx/commit/23607c4b1635a909bd0f956ff8d8760b05dcaf74))
* record Phase 3 (planner) + Phase 5 (insights) as built ([529fc06](https://github.com/blenderXL/beyondx/commit/529fc0622027b1d66311cc9a068dc80b5fbf4dec))
* record Phase 4 (payoff engine) as built ([478fa2b](https://github.com/blenderXL/beyondx/commit/478fa2b04e02580a2be1201ddfa5a4b78e2fc3e3))
* update living docs for v0.1.2 auth release; scrub test creds ([cf88ee1](https://github.com/blenderXL/beyondx/commit/cf88ee1d6fb1b401e1d7a4f61cbb4097bc6676d7))
* update living docs for v0.1.2 auth release; scrub test creds ([53ff538](https://github.com/blenderXL/beyondx/commit/53ff5388c07549d4eb9b163b11b1f53e2d4a0fb5))

## [0.1.2](https://github.com/blenderXL/beyondx/compare/v0.1.1...v0.1.2) (2026-05-31)


### Features

* **auth:** email+password login with TOTP MFA ([af37c7d](https://github.com/blenderXL/beyondx/commit/af37c7ded16c5a3224cd360c6e0b0815d9e2c9d9))
* **auth:** email+password login with TOTP MFA ([e8dadc2](https://github.com/blenderXL/beyondx/commit/e8dadc28737b4fee1736a391a96de5ebb20523f4))
* **landing:** remove day/night arrow callout from hero ([0745368](https://github.com/blenderXL/beyondx/commit/0745368913e4964e674466bb7d28525cf78491a2))
* **landing:** remove day/night arrow callout from hero ([ebcd91d](https://github.com/blenderXL/beyondx/commit/ebcd91d0a5fd01ee95e0c3a4ab8002bd3ea3c6b9))


### Refactoring

* **auth-tests:** read test creds from env only, never from git ([6ef557d](https://github.com/blenderXL/beyondx/commit/6ef557d40cbbfdc49c23e6de5e1ad6fad254a5ff))


### Documentation

* add living project-knowledge docs ([31551a2](https://github.com/blenderXL/beyondx/commit/31551a237c69a49e7ed6b9b451ecaad16989d9e5))
* add living project-knowledge docs (state, dev workflow, prod plan, progress) ([4cc0c1f](https://github.com/blenderXL/beyondx/commit/4cc0c1f364e99228fe1a99f6e95df1564c7a07f6))

## [0.1.1](https://github.com/blenderXL/beyondx/compare/v0.1.0...v0.1.1) (2026-05-29)


### Features

* scaffold v1.0 — landing, auth, signed-in shell, schema ([5078d87](https://github.com/blenderXL/beyondx/commit/5078d872d44f2fd137e1e58ae9aed6d7550d1cc4))


### Bug Fixes

* bump next to 15.1.11 to patch RCE/DoS CVEs and unblock Vercel deploy ([a78c56f](https://github.com/blenderXL/beyondx/commit/a78c56f3b5b4c906ff7de70f0ad3631fc3b71fe3))


### Documentation

* clarify Supabase API key choice and defer service_role to v1.1 ([cc6b639](https://github.com/blenderXL/beyondx/commit/cc6b6393131d694adee8f5341dfa5e0e3871e878))
