import { labelClass } from "@/components/finance/formStyles";

/** Rendered for a route whose release flag is OFF — graceful, no hint of internals. */
export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-5xl">
      <p className={labelClass}>// {title.toLowerCase()}</p>
      <h1 className="mt-2 font-sans text-3xl font-medium text-[var(--color-text-primary)]">{title}</h1>
      <div className="mt-8 rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-strong)] p-10 text-center">
        <p className="font-mono text-sm text-[var(--color-text-muted)]">
          // coming soon — this section isn&apos;t available yet
        </p>
      </div>
    </div>
  );
}
