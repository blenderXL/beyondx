/**
 * Single source of truth for the legal documents' version. Bumping CURRENT_LEGAL_VERSION
 * (after publishing updated copy) causes the first-login consent gate to re-prompt every user
 * to re-accept, and stamps the new version onto their acceptance record. Keep this in sync with
 * the "Version" header in `docs/legal/*.md` and the metadata in `lib/legal/content.tsx`.
 */
export const CURRENT_LEGAL_VERSION = "2026-07-01";

export const LEGAL_EFFECTIVE_DATE = "July 1, 2026";
export const LEGAL_LAST_UPDATED = "July 1, 2026";

/** The documents a user accepts together at the consent gate (for the audit trail). */
export const LEGAL_DOCUMENTS = ["terms", "privacy", "disclaimer"] as const;
export type LegalDocKey = (typeof LEGAL_DOCUMENTS)[number];
