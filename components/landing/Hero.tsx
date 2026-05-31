"use client";

import { motion } from "framer-motion";
import { CenterpieceSvg } from "./CenterpieceSvg";
import { LiveClock } from "./LiveClock";

const fade = {
  hidden: { opacity: 0, y: 8 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.2 + i * 0.12, duration: 0.6, ease: [0.2, 0.7, 0.2, 1] },
  }),
};

export function Hero() {
  return (
    <section
      aria-label="Hero"
      className="gradient-floor relative isolate flex min-h-[calc(100svh-72px)] flex-col"
    >
      {/* Hairline horizon */}
      <div aria-hidden className="hairline absolute left-0 right-0 top-[55%]" />

      {/* Centerpiece */}
      <div className="relative flex flex-1 items-center justify-center">
        <motion.div
          custom={0}
          variants={fade}
          initial="hidden"
          animate="show"
          className="relative"
        >
          <CenterpieceSvg />
        </motion.div>
      </div>

      {/* Bottom row: tagline · scroll hint · clock */}
      <div className="relative grid grid-cols-3 items-end px-6 pb-8 sm:px-10 sm:pb-10">
        <motion.p
          custom={3}
          variants={fade}
          initial="hidden"
          animate="show"
          className="max-w-[26ch] font-mono text-xs leading-relaxed text-[var(--color-text-secondary)]"
        >
          // Plan your way out, month by month.
          <br />
          Snowball or avalanche, your call.
        </motion.p>
        <motion.p
          custom={4}
          variants={fade}
          initial="hidden"
          animate="show"
          className="flex items-center justify-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-[var(--color-text-secondary)]"
        >
          Scroll Down <span aria-hidden>■</span>
        </motion.p>
        <motion.div
          custom={5}
          variants={fade}
          initial="hidden"
          animate="show"
          className="flex justify-end"
        >
          <LiveClock />
        </motion.div>
      </div>
    </section>
  );
}
