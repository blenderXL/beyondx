import type { Tier } from "@/lib/entitlements/getEntitlements";
import { Lock } from "lucide-react";

interface Props {
  requiredTier: Tier;
  reason?: string;
}

export function UpgradeCard({ requiredTier, reason }: Props) {
  return (
    <div
      role="region"
      aria-label={`Requires ${requiredTier} plan`}
      className="relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-8"
    >
      <div className="absolute left-0 top-0 h-full w-[3px] bg-[var(--color-accent-amber)]" />
      <div className="flex items-start gap-4">
        <div className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] p-2">
          <Lock className="size-4 text-[var(--color-accent-amber)]" />
        </div>
        <div className="flex-1">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
            // requires {requiredTier}
          </p>
          <h3 className="mt-2 font-sans text-xl font-medium text-[var(--color-text-primary)]">
            Unlock this with NZX Pro
          </h3>
          <p className="mt-2 max-w-prose text-sm text-[var(--color-text-secondary)]">
            {reason ??
              "Pro unlocks the AI assistant, advanced charts, and exportable plans. Free tier is plenty to get a payoff schedule going."}
          </p>
          <p className="mt-4 inline-flex items-center gap-2 rounded-md border border-dashed border-[var(--color-border-strong)] px-3 py-2 font-mono text-xs text-[var(--color-text-muted)]">
            Pro coming soon — wired up in v1.1
          </p>
        </div>
      </div>
    </div>
  );
}
