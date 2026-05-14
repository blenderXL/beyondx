"use client";

import { useEffect, useState } from "react";

function format(d: Date): string {
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const period = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return `${h.toString().padStart(2, "0")} : ${m} ${period}`;
}

export function LiveClock({ className }: { className?: string }) {
  const [now, setNow] = useState<string | null>(null);

  useEffect(() => {
    setNow(format(new Date()));
    const id = setInterval(() => setNow(format(new Date())), 15_000);
    return () => clearInterval(id);
  }, []);

  return (
    <span
      suppressHydrationWarning
      aria-live="off"
      className={`font-mono text-xs tracking-[0.18em] text-[var(--color-text-secondary)] tabular-nums ${className ?? ""}`}
    >
      {now ?? "•• : •• ••"}
    </span>
  );
}
