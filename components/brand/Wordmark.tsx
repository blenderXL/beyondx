import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  size?: "sm" | "md" | "lg";
}

const SIZE = { sm: "text-base", md: "text-lg", lg: "text-2xl" } as const;

export function Wordmark({ className, size = "md" }: Props) {
  return (
    <span
      aria-label="NZX"
      className={cn(
        "inline-flex items-center font-mono font-medium tracking-[0.32em] text-[var(--color-text-primary)]",
        SIZE[size],
        className,
      )}
    >
      <span aria-hidden className="mr-1 inline-block size-1.5 rounded-full bg-[var(--color-accent-emerald)]" />
      NZX
    </span>
  );
}
