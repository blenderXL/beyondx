"use client";

import { motion } from "framer-motion";

/**
 * A stylized "monitor" sitting on the horizon with an animated
 * payoff curve descending inside — debt going to zero, month by month.
 * Designed to read as the visual centerpiece. Pure SVG, no canvas.
 */
export function CenterpieceSvg() {
  // The chart curve traces from upper-left (high balance) down to lower-right (zero).
  // Slight ease-out via control points so it feels like a snowball/avalanche payoff.
  const curve = "M 38 36 C 60 42, 78 58, 96 78 S 138 116, 168 122";

  return (
    <div className="relative pointer-events-none select-none">
      {/* Glow halo */}
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 -z-10 size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60 blur-[64px]"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--color-text-primary), transparent 80%) 0%, transparent 65%)",
        }}
      />
      <svg
        role="img"
        aria-label="Animated chart showing a debt balance falling toward zero"
        width="260"
        height="220"
        viewBox="0 0 220 180"
        className="drop-shadow-[0_24px_40px_rgba(0,0,0,0.45)]"
      >
        <defs>
          <linearGradient id="screen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="color-mix(in oklab, var(--color-elevated), white 4%)" />
            <stop offset="100%" stopColor="var(--color-elevated)" />
          </linearGradient>
          <linearGradient id="curveGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-accent-emerald)" />
            <stop offset="100%" stopColor="var(--color-accent-blue)" />
          </linearGradient>
        </defs>

        {/* Monitor body */}
        <rect
          x="14"
          y="14"
          width="192"
          height="138"
          rx="10"
          fill="var(--color-surface)"
          stroke="var(--color-border-strong)"
          strokeWidth="1"
        />
        {/* Screen */}
        <rect
          x="26"
          y="26"
          width="168"
          height="106"
          rx="6"
          fill="url(#screen)"
          stroke="var(--color-border-subtle)"
          strokeWidth="1"
        />
        {/* Grid lines (axis ticks) */}
        <g stroke="var(--color-border-subtle)" strokeWidth="0.5" opacity="0.7">
          {[44, 60, 76, 92, 108, 124].map((y) => (
            <line key={`h-${y}`} x1="30" x2="190" y1={y} y2={y} />
          ))}
          {[50, 80, 110, 140, 170].map((x) => (
            <line key={`v-${x}`} y1="30" y2="128" x1={x} x2={x} />
          ))}
        </g>

        {/* Target line (zero balance) */}
        <line
          x1="30"
          y1="124"
          x2="190"
          y2="124"
          stroke="var(--color-accent-emerald)"
          strokeWidth="1"
          strokeDasharray="3 3"
          opacity="0.7"
        />

        {/* Payoff curve — animated draw */}
        <motion.path
          d={curve}
          fill="none"
          stroke="url(#curveGrad)"
          strokeWidth="2.25"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ pathLength: { duration: 2.4, ease: [0.2, 0.7, 0.2, 1] }, opacity: { duration: 0.4 } }}
        />

        {/* Endpoint dot pulsing at zero */}
        <motion.circle
          cx="168"
          cy="122"
          r="3"
          fill="var(--color-accent-emerald)"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: [0, 1, 1, 0.6], scale: [0.6, 1.1, 1, 1] }}
          transition={{ delay: 2.4, duration: 1.6, repeat: Infinity, repeatType: "reverse" }}
        />

        {/* Caption inside screen */}
        <g fontFamily="var(--font-mono)" fontSize="6" fill="var(--color-text-muted)">
          <text x="32" y="40" letterSpacing="0.5">// balance · monthly</text>
          <text x="178" y="40" textAnchor="end" letterSpacing="0.5" fill="var(--color-accent-emerald)">
            target · 0
          </text>
        </g>

        {/* Stand */}
        <rect x="92" y="152" width="36" height="6" rx="1.5" fill="var(--color-surface)" stroke="var(--color-border-strong)" strokeWidth="1" />
        <rect x="70" y="158" width="80" height="6" rx="2" fill="var(--color-surface)" stroke="var(--color-border-strong)" strokeWidth="1" />
      </svg>
    </div>
  );
}
