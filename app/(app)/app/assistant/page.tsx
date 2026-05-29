import { RequireTier } from "@/components/entitlements/RequireTier";

export default function AssistantPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--color-accent-purple)]">
          // assistant
        </p>
        <h1 className="mt-3 font-sans text-3xl font-medium leading-tight text-[var(--color-text-primary)]">
          Chat through your plan
        </h1>
        <p className="mt-2 max-w-prose text-sm text-[var(--color-text-secondary)]">
          Pro unlocks an AI assistant that reads your portfolio and walks you through snowball
          vs. avalanche vs. custom orderings — in plain English.
        </p>
      </div>
      <RequireTier tier="pro">
        {/* v1.2: real assistant UI streams here once a provider is wired in. */}
        <div className="rounded-[var(--radius-card)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-8">
          <p className="font-mono text-xs text-[var(--color-text-secondary)]">
            // assistant ready — provider not yet configured.
          </p>
        </div>
      </RequireTier>
    </div>
  );
}
