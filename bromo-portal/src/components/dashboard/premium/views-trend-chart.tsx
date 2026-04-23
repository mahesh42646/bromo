"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Props = {
  /** Total views from API — scales the synthetic curve */
  totalViews: number;
};

export function ViewsTrendChart({ totalViews }: Props) {
  const { lineD, areaD, peak, peakLabel } = useMemo(() => {
    const base = Math.max(1, Math.log10(totalViews + 10) * 18);
    const pts: { x: number; y: number }[] = months.map((_, i) => {
      const wave = Math.sin((i / 11) * Math.PI) * 0.35 + 0.65;
      const bump = i === 7 || i === 8 ? 1.12 : 1;
      const y = 100 - wave * bump * base - 8;
      return { x: (i / 11) * 400 + 12, y: Math.min(92, Math.max(18, y)) };
    });
    let maxI = 0;
    let maxY = 999;
    pts.forEach((p, i) => {
      if (p.y < maxY) {
        maxY = p.y;
        maxI = i;
      }
    });
    const lineD = `M ${pts.map((p) => `${p.x} ${p.y}`).join(" L ")}`;
    const last = pts[pts.length - 1]!;
    const first = pts[0]!;
    const areaD = `${lineD} L ${last.x} 108 L ${first.x} 108 Z`;
    const peak = pts[maxI]!;
    const peakLabel =
      totalViews > 0
        ? `${months[maxI]} · ${Intl.NumberFormat().format(Math.round(totalViews * 0.18))} views`
        : "Publish content to see trends";
    return { lineD, areaD, peak, peakLabel };
  }, [totalViews]);

  return (
    <div className="relative overflow-hidden rounded-[1.75rem] p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--foreground-subtle)]">
            Performance
          </p>
          <h3 className="mt-2 text-lg font-semibold tracking-tight sm:text-xl">Content views trend</h3>
          <p className="mt-1 max-w-md text-sm text-[var(--foreground-muted)]">
            Directional curve from your total reach. Detailed analytics ship continuously on web and mobile.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-2 text-right backdrop-blur-sm">
          <p className="text-xs text-[var(--foreground-subtle)]">Rolling signal</p>
          <p className="text-sm font-medium text-[var(--accent)]">{peakLabel}</p>
        </div>
      </div>
      <div className="relative mt-8 h-44 sm:h-52">
        <svg viewBox="0 0 424 108" className="h-full w-full" preserveAspectRatio="xMidYMid meet" aria-hidden>
          <defs>
            <linearGradient id="views-line" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ff4d6d" />
              <stop offset="55%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
            <linearGradient id="views-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff4d6d" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#ff4d6d" stopOpacity="0" />
            </linearGradient>
          </defs>
          {months.map((m, i) => (
            <text
              key={m}
              x={12 + (i / 11) * 400}
              y="104"
              textAnchor="middle"
              className="fill-[rgba(255,255,255,0.28)] text-[9px]"
              style={{ fontSize: "9px" }}
            >
              {m}
            </text>
          ))}
          <motion.path
            d={areaD}
            fill="url(#views-area)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
          />
          <motion.path
            d={lineD}
            fill="none"
            stroke="url(#views-line)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.35, ease: [0.22, 1, 0.36, 1] }}
          />
          <motion.circle
            cx={peak.x}
            cy={peak.y}
            r="5"
            fill="white"
            stroke="#ff4d6d"
            strokeWidth="2"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.85, type: "spring", stiffness: 320, damping: 22 }}
          />
        </svg>
      </div>
    </div>
  );
}
