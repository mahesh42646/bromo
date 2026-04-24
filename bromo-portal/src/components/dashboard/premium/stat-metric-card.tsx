"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import { Sparkline } from "@/components/dashboard/premium/sparkline";
import { cn } from "@/lib/cn";

type Props = {
  href: string;
  label: string;
  value: string | number;
  hint: string;
  icon: LucideIcon;
  sparkSeed: string;
  sparkColor: string;
  /** Monthly (or sequential) counts from the API for the mini chart. */
  sparkValues?: number[];
  highlight?: boolean;
  delay?: number;
};

export function StatMetricCard({
  href,
  label,
  value,
  hint,
  icon: Icon,
  sparkSeed,
  sparkColor,
  sparkValues,
  highlight,
  delay = 0,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link href={href} className="group block h-full">
        <div
          className={cn(
            "dash-glass relative h-full overflow-hidden rounded-[1.35rem] p-5 transition-all duration-300",
            "ring-1 ring-white/[0.07]",
            highlight
              ? "bg-linear-to-br from-[#6d28d9]/35 via-[#4c1d95]/25 to-transparent ring-violet-400/25"
              : "hover:ring-[var(--accent)]/25",
            "hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-24px_rgba(255,77,109,0.35)]",
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-medium text-[var(--foreground-muted)]">{label}</p>
            <span className="rounded-xl bg-white/5 p-1.5 ring-1 ring-white/10 transition-colors group-hover:bg-[var(--accent)]/15">
              <Icon className="size-4 text-[var(--accent)]" aria-hidden />
            </span>
          </div>
          <p className="mt-4 text-3xl font-semibold tabular-nums tracking-tight sm:text-[2rem]">{value}</p>
          <p className="mt-1 line-clamp-2 text-xs text-[var(--foreground-subtle)]">{hint}</p>
          <div className="mt-4 h-8 w-full opacity-90">
            <Sparkline values={sparkValues} seed={sparkSeed} color={sparkColor} className="h-full w-full" />
          </div>
          <ArrowUpRight className="absolute right-4 top-4 size-4 text-[var(--foreground-subtle)] opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
      </Link>
    </motion.div>
  );
}
