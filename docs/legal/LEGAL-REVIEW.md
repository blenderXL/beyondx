# NZX Legal Review — Gap Analysis & Required Follow-ups

**Date:** July 1, 2026
**Status:** Draft for internal use — **not for publication**

> ## ⚠️ This is not legal advice
> This document was prepared by a non-lawyer as an engineering aid. It is an informed pass to make
> the NZX legal documents more complete and defensible — **not** a substitute for professional legal
> counsel. **You must have a licensed attorney** (in `<JURISDICTION>`, and covering any EU/UK/California
> users you intend to serve) **review the Terms of Service and Privacy Policy before you launch or
> take payments.** Do not treat anything here as a guarantee that NZX is protected from liability.

## 1. What this pass added

**Terms of Service** — added, on top of the original draft:
- Eligibility & age (18+, no under-13 / COPPA).
- Acceptable Use (no scraping, reverse-engineering, abuse, unlawful use, AI misuse).
- Intellectual Property & Licenses (NZX owns the app; **user owns their data** and grants a limited processing license; feedback license).
- Account Termination & Suspension + survival clause + data-export window.
- **Changes to the Terms → material changes require re-acceptance** (backed by the versioned consent gate + audit log in the app).
- Electronic Communications & **E-SIGN consent** (makes the "I agree" click an enforceable electronic signature).
- Subscription / **auto-renewal & cancellation** disclosures (California ARL-style), price-change notice, refunds, and a note that the billing provider (Lemon Squeezy) may be the **merchant of record**.
- Arbitration refinements: **30-day opt-out**, small-claims carve-out, delegation clause (kept the class-action waiver).
- Force Majeure, non-waivable-rights carve-out, `$100` liability floor, contact section.

**Privacy Policy** — rewrote from the minimal draft to add: controller identity, **subprocessor list** (Supabase, Vercel, Lemon Squeezy, Anthropic/OpenAI, **PostHog**, **Sentry**), cookies & analytics disclosure, GDPR legal bases, CCPA/CPRA rights (no sale / no sharing for cross-context ads), expanded user rights pointing to the **real** in-app export + delete, retention schedule, international transfers, children's privacy, security specifics (encryption + RLS), breach notification, and change notice.

**In-app disclaimer** — added an explicit acknowledgment sentence used verbatim by the consent gate.

## 2. Required follow-ups before launch (non-code)

1. **Attorney review — required.** Have counsel review both documents, confirm the arbitration/class-waiver and limitation-of-liability clauses are enforceable in `<JURISDICTION>`, and confirm applicability of GDPR/CCPA/CPRA to your audience.
2. **Form and name a legal entity.** The liability shield in the Terms assumes an entity (`<LEGAL ENTITY>`). Operating as an individual/sole proprietor provides **no** liability shield — form an LLC (or similar) and insert its exact name and state.
3. **Fill placeholders:** `<LEGAL ENTITY>`, `<JURISDICTION>`, `<CONTACT EMAIL>` (and set up the mailbox/forwarding).
4. **Billing:** confirm whether Lemon Squeezy is the **merchant of record** for your sales; align the Terms' refund/tax/auto-renewal language with LS's actual policies, and satisfy US auto-renewal laws (clear disclosure, easy cancellation, renewal reminders where required).
5. **Data Processing Agreements / subprocessor terms:** execute/verify DPAs with Supabase, Vercel, Anthropic/OpenAI, PostHog, and Sentry. Keep the subprocessor list in the Privacy Policy in sync with reality.
6. **EU/cookie consent:** if you target EU/UK users, non-essential analytics (PostHog) generally require **prior consent** — add a cookie-consent banner and gate PostHog on consent. (Today PostHog only loads when `NEXT_PUBLIC_POSTHOG_KEY` is set and masks inputs, but that is not the same as consent.)
7. **Business insurance:** consider Errors & Omissions (professional liability) and cyber-liability coverage.
8. **Records:** the app records each acceptance (version + timestamp + IP + user-agent) in an append-only `legal_acceptances` table — retain this as evidence of consent.
9. **Accessibility & availability:** the published legal pages should remain publicly reachable (no login wall) and accessible.

## 3. Known gaps / decisions still open

- Whether to serve EU users at all (drives GDPR banner + SCC obligations).
- Whether to add a standalone **Cookie Policy** page (currently folded into the Privacy Policy).
- DMCA / user-generated-content policy — minimal today (no public UGC), revisit if that changes.
- Accessibility statement, and a security.txt / vulnerability-disclosure policy (nice-to-have).

## 4. Source of truth

- Drafting originals: `docs/legal/*.md` (this folder).
- Published copy rendered by the app: `lib/legal/content.tsx` + `lib/legal/version.ts` (keep in sync with these drafts).
- `CURRENT_LEGAL_VERSION` in `lib/legal/version.ts` must match the **Version** header in these documents; bumping it re-prompts all users to re-accept.
