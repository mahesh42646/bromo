"use client";

import { motion } from "framer-motion";
import { useId, useMemo } from "react";

function pointsFromSeed(seed: string, n: number): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    out.push(0.2 + ((h >>> 0) % 1000) / 1900);
  }
  return out;
}

type Props = {
  /** When set, draws from real samples (e.g. monthly counts). */
  values?: number[];
  /** Fallback decorative path when `values` is omitted (legacy). */
  seed: string;
  color: string;
  className?: string;
};

export function Sparkline({ values, seed, color, className }: Props) {
  const gid = useId().replace(/:/g, "");
  const { lineD, areaD } = useMemo(() => {
    const w = 100;
    const h = 32;
    let vals: number[];
    if (values != null && values.length > 0) {
      vals = values.map((v) => Number(v) || 0);
    } else {
      vals = pointsFromSeed(seed, 14);
    }
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const norm = vals.map((v) => (max === min ? 0.5 : (v - min) / (max - min)));
    const xy = norm.map((v, i) => {
      const x = vals.length <= 1 ? w / 2 : (i / (norm.length - 1)) * w;
      const y = h - v * (h - 4) - 2;
      return [x, y] as const;
    });
    const lineD = `M ${xy.map(([x, y]) => `${x} ${y}`).join(" L ")}`;
    const last = xy[xy.length - 1]!;
    const areaD = `${lineD} L ${last[0]} ${h} L 0 ${h} Z`;
    return { lineD, areaD };
  }, [seed, values]);

  return (
    <svg viewBox="0 0 100 32" className={className} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={`spark-fill-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={areaD}
        fill={`url(#spark-fill-${gid})`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      />
      <motion.path
        d={lineD}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.05, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  );
}
