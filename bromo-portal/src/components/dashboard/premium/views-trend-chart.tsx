"use client";

import { motion } from "framer-motion";
import { useMemo, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/cn";

export type ChartRangeOption = "7d" | "30d" | "1y" | "all";

export type PerformanceChartSlice = {
  chartRange: ChartRangeOption;
  chartBucket: "day" | "month";
  chartKeys: string[];
  chartViews: number[];
  chartImpressions: number[];
  chartPublished: number[];
};

type ChartMode = "views" | "impressions" | "published";

const RANGE_TABS: { id: ChartRangeOption; label: string }[] = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "1 month" },
  { id: "1y", label: "1 year" },
  { id: "all", label: "All time" },
];

const MAX_RIBBON_BARS = 36;

type Props = PerformanceChartSlice & {
  totalViews: number;
  totalImpressions: number;
  gridTotal: number;
  /** Last 24 months of views-by-publish-month (same as stat sparklines). Used if API chart arrays are empty. */
  sparklineMonthsUtc: string[];
  sparklineViewsByMonth: number[];
};

function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + (Number(b) || 0), 0);
}

function pickSeries(
  views: number[],
  impressions: number[],
  published: number[],
): { mode: ChartMode; values: number[] } {
  if (sum(views) > 0) return { mode: "views", values: views.map((v) => Number(v) || 0) };
  if (sum(impressions) > 0) return { mode: "impressions", values: impressions.map((v) => Number(v) || 0) };
  if (sum(published) > 0) return { mode: "published", values: published.map((v) => Number(v) || 0) };
  return { mode: "views", values: views.map((v) => Number(v) || 0) };
}

/** Map monthly sparkline onto chart month keys (1y / all). */
function alignSparklineToKeys(
  chartKeys: string[],
  sparkMonths: string[],
  sparkVals: number[],
): number[] {
  const m = new Map<string, number>();
  sparkMonths.forEach((k, i) => {
    m.set(k, Number(sparkVals[i]) || 0);
  });
  return chartKeys.map((k) => m.get(k) ?? 0);
}

/** Downsample long ranges so the ribbon stays readable at a glance. */
function ribbonSeries(raw: number[], maxPts: number): number[] {
  if (raw.length <= maxPts) return raw.map((v) => Number(v) || 0);
  const out: number[] = [];
  const w = raw.length / maxPts;
  for (let b = 0; b < maxPts; b++) {
    const a = Math.floor(b * w);
    const c = Math.floor((b + 1) * w);
    let s = 0;
    for (let i = a; i < c; i++) s += Number(raw[i]) || 0;
    out.push(s);
  }
  return out;
}

function rangeHint(id: ChartRangeOption): string {
  switch (id) {
    case "7d":
      return "Last 7 days";
    case "30d":
      return "Last 30 days";
    case "1y":
      return "Last 12 months";
    case "all":
      return "Since your first post";
    default:
      return "";
  }
}

export function ViewsTrendChart({
  chartRange,
  chartBucket,
  chartKeys,
  chartViews,
  chartImpressions,
  chartPublished,
  totalViews,
  totalImpressions,
  gridTotal,
  sparklineMonthsUtc,
  sparklineViewsByMonth,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const onSelectRange = (next: ChartRangeOption) => {
    if (next === chartRange) return;
    startTransition(() => {
      const params = new URLSearchParams(
        typeof window !== "undefined" ? window.location.search.slice(1) : "",
      );
      params.set("cr", next);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      router.refresh();
    });
  };

  const { ribbon, mode, hasSignal, usedSparklineFallback, windowHasNoPublishes } = useMemo(() => {
    const { mode, values } = pickSeries(chartViews, chartImpressions, chartPublished);
    let aligned = chartKeys.map((_, i) => Number(values[i]) || 0);
    let usedSparklineFallback = false;

    if (sum(aligned) === 0 && (chartRange === "1y" || chartRange === "all") && chartBucket === "month") {
      const sparkSum = sum(sparklineViewsByMonth);
      if (sparkSum > 0 && totalViews > 0) {
        const fromSpark = alignSparklineToKeys(chartKeys, sparklineMonthsUtc, sparklineViewsByMonth);
        if (sum(fromSpark) > 0) {
          aligned = fromSpark;
          usedSparklineFallback = true;
        }
      }
    }

    const ribbonRaw = ribbonSeries(aligned, MAX_RIBBON_BARS);
    const hasSignal = ribbonRaw.some((v) => v > 0);
    const publishedInWindow = sum(
      chartKeys.map((_, i) => Number(chartPublished[i]) || 0),
    );
    const windowHasNoPublishes =
      (chartRange === "7d" || chartRange === "30d") && publishedInWindow === 0 && gridTotal > 0;

    return { ribbon: ribbonRaw, mode, hasSignal, usedSparklineFallback, windowHasNoPublishes };
  }, [
    chartKeys,
    chartBucket,
    chartRange,
    chartViews,
    chartImpressions,
    chartPublished,
    totalViews,
    gridTotal,
    sparklineMonthsUtc,
    sparklineViewsByMonth,
  ]);

  const hues = [340, 12, 28, 280, 45, 200];

  return (
    <div className={cn("relative overflow-hidden rounded-[1.75rem] p-6 sm:p-8", isPending && "opacity-80")}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--foreground-subtle)]">
            Performance
          </p>
          <h3 className="mt-1.5 text-lg font-semibold tracking-tight sm:text-xl">Reach at a glance</h3>
          <p className="mt-1 max-w-lg text-sm text-[var(--foreground-muted)]">
            The large number is <span className="text-[var(--foreground)]/90">all-time views</span> on your grid. The
            ribbon compares <span className="text-[var(--foreground)]/90">{rangeHint(chartRange)}</span> by{" "}
            {chartBucket === "day" ? "publish day" : "publish month"} — taller bars mean more{" "}
            {mode === "published" ? "publishing" : mode === "impressions" ? "impressions" : "views"} in that bucket.
            {usedSparklineFallback ? (
              <span className="mt-1 block text-[var(--foreground-subtle)]">
                (Ribbon filled from your last 24 months snapshot where the detailed range had no data.)
              </span>
            ) : null}
          </p>
        </div>

        <div
          className="flex flex-wrap gap-1 self-start rounded-2xl bg-black/30 p-1 ring-1 ring-white/10 lg:self-center"
          role="tablist"
          aria-label="Time range"
        >
          {RANGE_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={chartRange === t.id}
              disabled={isPending}
              onClick={() => onSelectRange(t.id)}
              className={cn(
                "rounded-xl px-3 py-1.5 text-xs font-medium transition-colors",
                chartRange === t.id
                  ? "bg-[var(--accent)]/25 text-[var(--accent)] ring-1 ring-[var(--accent)]/35"
                  : "text-[var(--foreground-muted)] hover:bg-white/5 hover:text-[var(--foreground)]",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-linear-to-br from-[#ff4d6d]/12 via-transparent to-[#a855f7]/10 px-5 py-4 ring-1 ring-white/[0.06]">
          <p className="text-xs font-medium text-[var(--foreground-subtle)]">Views on your grid</p>
          <p className="mt-1 bg-linear-to-r from-[#ff7a93] via-[#ffb86c] to-[#c4b5fd] bg-clip-text text-4xl font-semibold tabular-nums tracking-tight text-transparent sm:text-5xl">
            {Intl.NumberFormat().format(totalViews)}
          </p>
          {totalImpressions > 0 && totalImpressions !== totalViews ? (
            <p className="mt-2 text-xs text-[var(--foreground-muted)]">
              {Intl.NumberFormat().format(totalImpressions)} impressions (separate counter)
            </p>
          ) : (
            <p className="mt-2 text-xs text-[var(--foreground-muted)]">Lifetime total · posts & reels on your profile</p>
          )}
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 ring-1 ring-white/[0.06]">
          <p className="text-xs font-medium text-[var(--foreground-subtle)]">Grid items</p>
          <p className="mt-1 text-4xl font-semibold tabular-nums tracking-tight text-[var(--foreground)] sm:text-5xl">
            {gridTotal}
          </p>
          <p className="mt-2 text-xs text-[var(--foreground-muted)]">Published posts & reels (not stories)</p>
        </div>
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--foreground-subtle)]">
            Activity ribbon · {rangeHint(chartRange)}
          </p>
          {windowHasNoPublishes ? (
            <span className="text-[10px] text-[var(--foreground-muted)] sm:text-xs">No publishes this window</span>
          ) : null}
        </div>
        <div
          className="flex h-24 items-end gap-px rounded-2xl bg-black/40 px-2 pb-2 pt-4 ring-1 ring-white/[0.07] sm:h-28 sm:gap-0.5 sm:px-3"
          role="img"
          aria-label="Relative activity over the selected period"
        >
          {ribbon.map((v, i) => {
            const mx = Math.max(...ribbon, 0);
            const norm = mx <= 0 || v <= 0 ? 0 : v / mx;
            const hPct = hasSignal ? 18 + 82 * Math.sqrt(norm) : 14;
            const hue = hues[i % hues.length]!;
            const glow = hasSignal && v > 0 ? 0.55 : 0.12;
            return (
              <motion.div
                key={`${chartRange}-${i}`}
                className="min-w-0 flex-1 rounded-t-md"
                initial={{ height: "12%" }}
                animate={{ height: `${hPct}%` }}
                transition={{ type: "spring", stiffness: 320, damping: 28, delay: i * 0.012 }}
                style={{
                  background: `linear-gradient(180deg, hsl(${hue} 78% 58%) 0%, hsl(${hue} 82% 38%) 100%)`,
                  opacity: hasSignal ? (v > 0 ? 0.92 : 0.2) : 0.22,
                  boxShadow: hasSignal && v > 0 ? `0 0 20px -4px hsl(${hue} 85% 50% / ${glow})` : undefined,
                }}
              />
            );
          })}
        </div>
        {!hasSignal && gridTotal === 0 ? (
          <p className="mt-3 text-center text-xs text-[var(--foreground-muted)]">
            Publish from the app to light up this ribbon.
          </p>
        ) : windowHasNoPublishes ? (
          <p className="mt-3 text-center text-xs text-[var(--foreground-muted)]">
            You did not publish anything in this short window, so the ribbon stays flat — your{" "}
            {Intl.NumberFormat().format(totalViews)} views are on older grid items. Open{" "}
            <span className="text-[var(--foreground)]/90">All time</span> or{" "}
            <span className="text-[var(--foreground)]/90">1 year</span> to see the monthly split.
          </p>
        ) : !hasSignal && gridTotal > 0 ? (
          <p className="mt-3 text-center text-xs text-[var(--foreground-muted)]">
            No per-bucket data matched this range (try another tab) or counts are still syncing. The headline total above
            is authoritative.
          </p>
        ) : (
          <p className="mt-3 text-center text-xs text-[var(--foreground-subtle)]">
            Compare bar heights for a quick read — not exact totals per bar.
          </p>
        )}
      </div>
    </div>
  );
}
