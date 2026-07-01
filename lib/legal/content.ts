/**
 * Published legal copy rendered by the /legal/* pages and referenced by the consent gate.
 * This is the app's source of truth for the PUBLISHED documents; `docs/legal/*.md` are the
 * drafting originals — keep them in sync (see docs/legal/LEGAL-REVIEW.md).
 *
 * Inline **bold** markers are honored by the renderer (components/legal/LegalDoc.tsx).
 * Placeholders <LEGAL ENTITY> / <JURISDICTION> / <CONTACT EMAIL> must be filled before launch.
 */
import type { LegalDocKey } from "@/lib/legal/version";

export type LegalBlock =
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "callout"; text: string };

export interface LegalSection {
  heading: string;
  blocks: LegalBlock[];
}

export interface LegalContent {
  key: LegalDocKey;
  title: string;
  label: string;
  intro: LegalBlock[];
  sections: LegalSection[];
}

const p = (text: string): LegalBlock => ({ kind: "p", text });
const ul = (items: string[]): LegalBlock => ({ kind: "ul", items });
const callout = (text: string): LegalBlock => ({ kind: "callout", text });

export const TERMS: LegalContent = {
  key: "terms",
  title: "Terms of Service",
  label: "// terms of service",
  intro: [
    p(
      'These Terms of Service ("Terms") govern your access to and use of NZX ("NZX", "we", "us", or "our"), operated by <LEGAL ENTITY>, including our website, web application, and any related services (collectively, the "Service").',
    ),
    p(
      'By accessing or using the Service — including by clicking "I agree", creating an account, or otherwise using NZX — you agree to be bound by these Terms. If you do not agree, you may not use the Service.',
    ),
  ],
  sections: [
    {
      heading: "1. Description of the Service",
      blocks: [
        p(
          "NZX is a personal finance and debt management platform that allows users to manually track debts, expenses, savings, and create debt payoff plans. A paid PRO subscription unlocks additional features including advanced analytics, goals tracking, and enhanced AI capabilities.",
        ),
      ],
    },
    {
      heading: "2. No Professional Advice – Extremely Important",
      blocks: [
        p("**YOU ACKNOWLEDGE AND AGREE THAT:**"),
        ul([
          "NZX is provided **solely for informational, educational, and personal organizational purposes**.",
          "NZX, including all debt payoff plans, budget suggestions, forecasts, scenarios, and outputs from the AI Assistant, **does not constitute financial, investment, tax, legal, credit, accounting, or any other form of professional advice**.",
          "We are **not** a licensed financial advisor, Registered Investment Advisor (RIA), broker-dealer, Certified Public Accountant (CPA), attorney, or fiduciary.",
          "The AI Assistant uses large language models that can produce inaccurate, incomplete, biased, or hallucinatory outputs. You should **never** rely solely on AI-generated content for any financial decision.",
          "You are **solely and exclusively responsible** for all decisions you make based on information obtained through NZX.",
          "You should consult with qualified, licensed professionals before making any financial, investment, tax, or legal decisions.",
        ]),
        p("**We expressly disclaim any duty to provide advice or to act in your best interest.**"),
      ],
    },
    {
      heading: "3. AI Assistant – Specific Warnings and Limitations",
      blocks: [
        p("The AI Assistant is an experimental feature. You understand and agree that:"),
        ul([
          "AI outputs are generated probabilistically and may be factually incorrect.",
          "We do not guarantee the accuracy, completeness, timeliness, or suitability of any AI response.",
          "AI responses are not personalized recommendations and should not be treated as such.",
          "Your queries and relevant financial data may be processed by third-party AI providers as described in our Privacy Policy.",
          "We reserve the right to modify, limit, or discontinue the AI Assistant at any time without notice.",
        ]),
      ],
    },
    {
      heading: "4. Eligibility and Age",
      blocks: [
        p(
          "You must be at least **18 years old** (or the age of majority in your jurisdiction, if higher) and capable of forming a binding contract to use the Service. The Service is **not directed to children under 13**, and we do not knowingly collect personal information from children under 13. By using the Service you represent that you meet these eligibility requirements.",
        ),
      ],
    },
    {
      heading: "5. Your Account and Security",
      blocks: [
        p(
          "You are responsible for maintaining the confidentiality of your login credentials and for all activity under your account. You agree to provide accurate information, keep it current, and notify us immediately of any unauthorized use. We are not liable for any loss arising from unauthorized use of your account.",
        ),
      ],
    },
    {
      heading: "6. Acceptable Use",
      blocks: [
        p("You agree **not** to:"),
        ul([
          "use the Service for any unlawful, fraudulent, or abusive purpose;",
          "access, tamper with, or use non-public areas of the Service, or probe or test the vulnerability of our systems;",
          "reverse engineer, decompile, or attempt to extract the source code of the Service, except as permitted by law;",
          "scrape, crawl, or harvest data from the Service, or use it to build a competing product;",
          "upload malware, or interfere with or disrupt the integrity or performance of the Service;",
          "misuse the AI Assistant to generate unlawful, harmful, or infringing content, or to circumvent usage limits.",
        ]),
        p(
          "We may investigate and take appropriate action, including suspending or terminating accounts, for violations.",
        ),
      ],
    },
    {
      heading: "7. Intellectual Property and Licenses",
      blocks: [
        p(
          "**Our property.** The Service, including its software, design, text, graphics, and logos (excluding Your Data), is owned by <LEGAL ENTITY> and its licensors and is protected by intellectual property laws. Subject to these Terms, we grant you a limited, non-exclusive, non-transferable, revocable license to access and use the Service for your personal, non-commercial use.",
        ),
        p(
          '**Your data.** You retain ownership of the financial and personal data you enter into NZX ("Your Data"). You grant us a limited, worldwide, royalty-free license to host, store, process, transmit, and display Your Data **solely as necessary to operate and provide the Service to you** (including, where you use the AI Assistant, transmitting relevant portions to our AI subprocessors as described in the Privacy Policy). This license ends when you delete Your Data or your account, subject to routine backup retention and legal obligations.',
        ),
        p(
          "**Feedback.** If you send us suggestions or feedback, you grant us a perpetual, irrevocable, royalty-free license to use it without restriction or obligation to you.",
        ),
      ],
    },
    {
      heading: "8. PRO Subscription, Billing, and Auto-Renewal",
      blocks: [
        p("PRO features are available via recurring subscription."),
        ul([
          "**Billing / merchant of record.** Payments are processed by our third-party billing provider (currently Lemon Squeezy), which may act as the **merchant of record**. Your purchase may also be subject to the billing provider's terms, and applicable taxes may be added.",
          "**Auto-renewal.** Subscriptions **automatically renew** for successive periods at the then-current price **until you cancel**. By subscribing, you authorize us and our billing provider to charge your payment method on each renewal.",
          "**Cancellation.** You may cancel at any time before the next renewal date through the app or your billing-provider account; cancellation takes effect at the end of the current billing period.",
          "**Price changes.** We will provide at least **30 days' notice** of any price change, effective on your next renewal.",
          "**Refunds.** Except where required by law, fees are non-refundable and no refunds are provided for partial billing periods. Refund eligibility may also be governed by the billing provider's policies.",
          "**Non-payment.** We may suspend or terminate PRO access for failed or overdue payments.",
        ]),
      ],
    },
    {
      heading: "9. Account Termination and Suspension",
      blocks: [
        p(
          "You may stop using the Service and delete your account at any time through the app's settings. We may suspend or terminate your access, with or without notice, if you violate these Terms, create risk or legal exposure for us, or if we discontinue the Service. You may export Your Data from the app's settings before deleting your account; after account deletion, Your Data is deleted as described in the Privacy Policy, subject to routine backups and legal obligations. Sections that by their nature should survive termination will survive.",
        ),
      ],
    },
    {
      heading: "10. Limitation of Liability",
      blocks: [
        p(
          "TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, NZX, <LEGAL ENTITY>, AND THEIR OWNERS, OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, AND AFFILIATES SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, PUNITIVE, OR EXEMPLARY DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, WHETHER BASED IN CONTRACT, TORT (INCLUDING NEGLIGENCE), STRICT LIABILITY, OR OTHERWISE, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.",
        ),
        p(
          "IN NO EVENT SHALL OUR TOTAL AGGREGATE LIABILITY TO YOU EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID TO US (IF ANY) IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM, OR (B) ONE HUNDRED U.S. DOLLARS ($100).",
        ),
        p(
          "Some jurisdictions do not allow the exclusion or limitation of certain damages, so some of the above may not apply to you. Nothing in these Terms limits liability that cannot be limited under applicable law.",
        ),
      ],
    },
    {
      heading: "11. Disclaimer of Warranties",
      blocks: [
        p(
          'THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT ANY WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE, OR THAT ANY CALCULATION OR OUTPUT WILL BE ACCURATE.',
        ),
      ],
    },
    {
      heading: "12. Indemnification",
      blocks: [
        p(
          "You agree to indemnify, defend, and hold harmless NZX and <LEGAL ENTITY> and their owners from and against any claims, damages, losses, liabilities, and expenses (including reasonable attorneys' fees) arising out of or related to your use of the Service, your violation of these Terms, or your violation of any rights of a third party.",
        ),
      ],
    },
    {
      heading: "13. Dispute Resolution and Arbitration",
      blocks: [
        p("**Please read this section carefully — it affects your legal rights.**"),
        p(
          "Any dispute arising out of or relating to these Terms or the Service shall be resolved through **binding arbitration** administered by JAMS in accordance with its Streamlined Arbitration Rules. The arbitration shall take place in <JURISDICTION>, or by videoconference where available. The arbitrator has exclusive authority to resolve disputes about the interpretation, applicability, or enforceability of this section.",
        ),
        ul([
          "**Class-action waiver.** **YOU AGREE TO WAIVE ANY RIGHT TO PARTICIPATE IN A CLASS ACTION OR CLASS-WIDE ARBITRATION.** Disputes will be resolved only on an individual basis.",
          "**Small-claims carve-out.** Either party may bring an individual claim in small-claims court if it qualifies.",
          "**30-day opt-out.** You may opt out of this arbitration agreement by emailing <CONTACT EMAIL> within **30 days** of first accepting these Terms, stating your name and intent to opt out.",
          "**Fees.** Payment of arbitration fees will be governed by the applicable JAMS rules.",
        ]),
      ],
    },
    {
      heading: "14. Governing Law and Venue",
      blocks: [
        p(
          "These Terms shall be governed by the laws of <JURISDICTION>, without regard to conflict-of-law principles. Any legal action not subject to arbitration shall be brought exclusively in the state or federal courts located in <JURISDICTION>, and you consent to their jurisdiction.",
        ),
      ],
    },
    {
      heading: "15. Changes to These Terms",
      blocks: [
        p(
          'We may update these Terms from time to time. When we do, we will update the "Last Updated" date and version above. For **material changes**, we will provide reasonable notice (for example, by email or an in-app notice) and, where appropriate, require you to **re-accept the updated Terms before continuing to use the Service**. Your continued use after changes take effect constitutes acceptance.',
        ),
      ],
    },
    {
      heading: "16. Electronic Communications and E-SIGN Consent",
      blocks: [
        p(
          'By using the Service, you consent to receive communications and agreements from us electronically, and you agree that your electronic acknowledgment (including clicking "I agree") constitutes your **electronic signature** and has the same legal effect as a handwritten signature. We keep a record of your acceptance, including the version accepted and the date and time.',
        ),
      ],
    },
    {
      heading: "17. Third-Party Services and Force Majeure",
      blocks: [
        p(
          "The Service integrates with third-party services (hosting, database/authentication, billing, analytics, error-monitoring, and AI model providers, as described in our Privacy Policy). We are not responsible for the practices of these third parties. We are also not liable for any failure or delay caused by events beyond our reasonable control, including natural disasters, war, civil unrest, internet or utility failures, third-party outages, or governmental action.",
        ),
      ],
    },
    {
      heading: "18. Miscellaneous",
      blocks: [
        p(
          "These Terms constitute the entire agreement between you and us regarding the Service and supersede any prior agreements. If any provision is found unenforceable, the remaining provisions remain in effect. Our failure to enforce a provision is not a waiver. We may assign these Terms; you may not assign them without our prior written consent. Nothing in these Terms limits any non-waivable rights you have under applicable law.",
        ),
        p("Questions about these Terms may be sent to <CONTACT EMAIL>."),
      ],
    },
  ],
};

export const PRIVACY: LegalContent = {
  key: "privacy",
  title: "Privacy Policy",
  label: "// privacy policy",
  intro: [
    p(
      'This Privacy Policy describes how NZX, operated by <LEGAL ENTITY> (the "data controller"), collects, uses, discloses, and protects your personal information when you use our website and application (the "Service").',
    ),
  ],
  sections: [
    {
      heading: "1. Information We Collect",
      blocks: [
        ul([
          "**Account information:** your email and a hashed password (managed by our authentication provider). If you sign in with Google, we receive basic profile information (name, email).",
          "**Financial information you enter:** debts, expenses, income, savings, payoff plans, and related notes you manually input.",
          "**AI Assistant inputs:** the queries you submit and the relevant financial context needed to answer them.",
          "**Usage and device data:** interactions with the Service, pages viewed, approximate location derived from IP, browser/device type, and log data.",
          "**Payment information:** handled by our billing provider; we do **not** store full card numbers. We receive limited billing status (subscription tier and status).",
        ]),
      ],
    },
    {
      heading: "2. How We Use Information",
      blocks: [
        p(
          "We use your information to operate, maintain, and improve the Service; provide personalized features (including AI insights); process subscriptions; communicate with you (including service and legal notices); provide support; ensure security and prevent fraud/abuse; and comply with legal obligations.",
        ),
        p(
          "**Legal bases (where GDPR applies):** performance of our contract with you, your consent (e.g., optional analytics/AI features where applicable), our legitimate interests (securing and improving the Service), and compliance with legal obligations.",
        ),
      ],
    },
    {
      heading: "3. AI Processing",
      blocks: [
        p(
          "When you use the AI Assistant, relevant portions of your financial data and your queries may be sent to third-party AI providers (e.g., Anthropic, OpenAI) to generate responses. We take reasonable steps to limit unnecessary data sharing and send only what is relevant to your request. These providers process data under their own terms.",
        ),
      ],
    },
    {
      heading: "4. Cookies and Analytics",
      blocks: [
        ul([
          "**Essential cookies:** strictly necessary to keep you signed in and operate the Service (set by our authentication provider). These cannot be disabled while using the Service.",
          "**Product analytics (PostHog):** where enabled, we use PostHog to understand how the Service is used. We configure it to **mask input contents** and to associate data only with identified, signed-in users.",
          "**Error monitoring (Sentry):** we use Sentry to capture crash and error diagnostics so we can fix problems.",
          "**Your choices:** you can block non-essential cookies via your browser. We honor recognized opt-out signals (such as Global Privacy Control / Do Not Track) where required by law.",
        ]),
      ],
    },
    {
      heading: "5. Service Providers and Subprocessors",
      blocks: [
        p(
          "We do **not sell** your personal information, and we do **not share** it for cross-context behavioral advertising. We share information with service providers that help us run the Service, each bound by confidentiality and data-protection obligations and governed by their own privacy terms:",
        ),
        ul([
          "**Supabase** — database, authentication, hosting of your data.",
          "**Vercel** — application hosting and delivery.",
          "**Lemon Squeezy** — subscription billing / merchant of record.",
          "**Anthropic, OpenAI** — AI Assistant model providers (only when you use the Assistant).",
          "**PostHog** — product analytics (when enabled).",
          "**Sentry** — error and performance monitoring.",
        ]),
        p(
          "We may also disclose information when required by law, to enforce our Terms, to protect rights and safety, or in connection with a merger, acquisition, or asset sale (with notice where required).",
        ),
      ],
    },
    {
      heading: "6. Data Security",
      blocks: [
        p(
          "We use industry-standard technical and organizational measures, including encryption in transit and at rest and per-row database access controls (Row-Level Security) so each user can access only their own records. However, no system is completely secure. In the event of a breach affecting your personal information, we will notify affected users and regulators as required by applicable law.",
        ),
      ],
    },
    {
      heading: "7. Your Rights and Choices",
      blocks: [
        p(
          "Depending on where you live (including under the EU/UK GDPR and the California CCPA/CPRA), you may have the right to access, correct, delete, export/port, restrict, or object to processing, and to withdraw consent. You also have the right not to be discriminated against for exercising these rights.",
        ),
        ul([
          "**Access & export:** export all your data as a file at any time from **Settings**.",
          "**Deletion:** delete your account and all associated data at any time from **Settings → Danger Zone**. Deletion cascades to your financial records.",
          "**Other requests:** contact us at <CONTACT EMAIL>. We respond within the timeframe required by applicable law (generally 30–45 days) and may verify your identity first.",
        ]),
      ],
    },
    {
      heading: "8. Data Retention",
      blocks: [
        p(
          "We retain your personal information for as long as your account is active or as needed to provide the Service. When you delete your account, your data is deleted from our active systems promptly (cascading across your financial records); residual copies may persist in routine encrypted backups for a limited period before being overwritten, and we may retain limited information as required by law.",
        ),
      ],
    },
    {
      heading: "9. International Data Transfers",
      blocks: [
        p(
          "The Service is operated and hosted in the United States. If you access it from outside the U.S., your information will be transferred to and processed in the U.S. and other countries where our subprocessors operate. Where required, we rely on appropriate safeguards (such as Standard Contractual Clauses) for such transfers.",
        ),
      ],
    },
    {
      heading: "10. Children's Privacy",
      blocks: [
        p(
          "The Service is not directed to children under 13, and we do not knowingly collect their personal information. If you believe a child has provided us information, contact us at <CONTACT EMAIL> and we will delete it.",
        ),
      ],
    },
    {
      heading: "11. Changes to This Policy",
      blocks: [
        p(
          'We may update this Privacy Policy from time to time. We will update the "Last Updated" date and version above and, for material changes, provide reasonable notice.',
        ),
        p("For privacy-related questions or to exercise your rights, contact us at <CONTACT EMAIL>."),
      ],
    },
  ],
};

export const DISCLAIMER: LegalContent = {
  key: "disclaimer",
  title: "Critical Disclaimers",
  label: "// not financial advice",
  intro: [callout("NZX IS NOT FINANCIAL ADVICE")],
  sections: [
    {
      heading: "Please read",
      blocks: [
        p(
          "NZX and its AI Assistant are tools for personal tracking and planning only. They are **not** substitutes for advice from licensed financial professionals.",
        ),
        p(
          "AI outputs can be inaccurate or misleading. Never make financial decisions based solely on information from NZX or the AI.",
        ),
        p(
          "You are fully responsible for your financial decisions. Consult qualified professionals before taking any action.",
        ),
        p("Use of NZX, including the AI Assistant, is at your own risk."),
      ],
    },
  ],
};

export const LEGAL_CONTENT: Record<LegalDocKey, LegalContent> = {
  terms: TERMS,
  privacy: PRIVACY,
  disclaimer: DISCLAIMER,
};
