import { Fragment } from "react";
import type { LegalBlock, LegalContent } from "@/lib/legal/content";
import { CURRENT_LEGAL_VERSION, LEGAL_EFFECTIVE_DATE, LEGAL_LAST_UPDATED } from "@/lib/legal/version";

/** Render inline **bold** spans within a legal paragraph/list item. */
function Inline({ text }: { text: string }) {
  const parts = text.split("**");
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-medium text-[var(--color-text-primary)]">
            {part}
          </strong>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

function Block({ block }: { block: LegalBlock }) {
  if (block.kind === "callout") {
    return (
      <p className="rounded-md border border-[var(--color-accent-amber)]/40 bg-[color-mix(in_oklab,var(--color-accent-amber),transparent_92%)] px-4 py-3 font-mono text-sm font-medium tracking-[0.04em] text-[var(--color-accent-amber)]">
        {block.text}
      </p>
    );
  }
  if (block.kind === "ul") {
    return (
      <ul className="space-y-2 pl-5">
        {block.items.map((item, i) => (
          <li key={i} className="list-disc text-sm leading-relaxed text-[var(--color-text-secondary)]">
            <Inline text={item} />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <p className="max-w-prose text-sm leading-relaxed text-[var(--color-text-secondary)]">
      <Inline text={block.text} />
    </p>
  );
}

/** Shared layout for a published legal document (terms / privacy / disclaimer). */
export function LegalDoc({ content }: { content: LegalContent }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-24 sm:px-10">
      <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--color-text-muted)]">
        {content.label}
      </p>
      <h1 className="mt-4 font-sans text-3xl font-medium leading-tight text-[var(--color-text-primary)] sm:text-4xl">
        {content.title}
      </h1>
      <p className="mt-4 font-mono text-[11px] tracking-[0.14em] text-[var(--color-text-muted)]">
        Effective {LEGAL_EFFECTIVE_DATE} · Updated {LEGAL_LAST_UPDATED} · v{CURRENT_LEGAL_VERSION}
      </p>

      <div className="mt-10 space-y-4">
        {content.intro.map((block, i) => (
          <Block key={i} block={block} />
        ))}
      </div>

      <div className="mt-12 space-y-12">
        {content.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="font-sans text-lg font-medium text-[var(--color-text-primary)]">
              {section.heading}
            </h2>
            <div className="mt-3 space-y-3">
              {section.blocks.map((block, i) => (
                <Block key={i} block={block} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
