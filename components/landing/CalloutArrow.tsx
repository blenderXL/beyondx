interface Props {
  className?: string;
  /** Direction the arrow head points. */
  direction?: "up-right" | "down-right" | "up-left" | "down-left";
}

/**
 * Hand-drawn curved arrow used to annotate UI affordances on the landing
 * (matches the visual vocabulary of hle.io's "Switch Day 'N' Night" callout).
 */
export function CalloutArrow({ className, direction = "up-right" }: Props) {
  const paths = {
    "up-right": "M 4 60 C 18 50, 32 30, 60 16",
    "down-right": "M 4 4 C 18 18, 32 38, 60 56",
    "up-left": "M 60 60 C 46 50, 32 30, 4 16",
    "down-left": "M 60 4 C 46 18, 32 38, 4 56",
  };
  const heads = {
    "up-right": "M 60 16 L 50 18 M 60 16 L 56 26",
    "down-right": "M 60 56 L 50 54 M 60 56 L 56 46",
    "up-left": "M 4 16 L 14 18 M 4 16 L 8 26",
    "down-left": "M 4 56 L 14 54 M 4 56 L 8 46",
  };
  return (
    <svg
      aria-hidden
      viewBox="0 0 64 64"
      width="48"
      height="48"
      className={className}
    >
      <path
        d={paths[direction]}
        fill="none"
        stroke="var(--color-text-muted)"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <path
        d={heads[direction]}
        fill="none"
        stroke="var(--color-text-muted)"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}
