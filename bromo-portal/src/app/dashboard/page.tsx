import type { Metadata } from "next";
import { DashboardOverview, type OverviewStats } from "@/components/dashboard/dashboard-overview";
import type { ChartRangeOption } from "@/components/dashboard/premium/views-trend-chart";
import { apiWithAuth, fetchMeServer } from "@/lib/server-api";

export const metadata: Metadata = {
  title: "Overview",
};

type OverviewPayload = {
  postCount?: number;
  reelCount?: number;
  gridTotal?: number;
  totalViews?: number;
  totalImpressions?: number;
  draftCount?: number;
  promoCount?: number;
  unreadCount?: number;
  monthsUtc?: string[];
  viewsByMonth?: number[];
  impressionsByMonth?: number[];
  gridPublishedByMonth?: number[];
  draftsCreatedByMonth?: number[];
  promotionsCreatedByMonth?: number[];
  notificationsReceivedByMonth?: number[];
  chartRange?: string;
  chartBucket?: "day" | "month";
  chartKeys?: string[];
  chartViews?: number[];
  chartImpressions?: number[];
  chartPublished?: number[];
};

type UnreadRes = { count?: number };
type GridStats = {
  postCount?: number;
  reelCount?: number;
  gridTotal?: number;
  totalViews?: number;
  totalImpressions?: number;
};
type DraftsRes = { drafts?: unknown[] };

const OVERVIEW_MONTHS = 24;
const DEFAULT_CHART_RANGE: ChartRangeOption = "30d";

function asChartRange(v: unknown): ChartRangeOption {
  if (v === "7d" || v === "30d" || v === "1y" || v === "all") return v;
  return DEFAULT_CHART_RANGE;
}

function lastNUtcMonthKeys(n: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function utcDateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function lastNDayKeysUtc(n: number): string[] {
  const today = startOfUtcDay(new Date());
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - (n - 1));
  const keys: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    keys.push(utcDateKey(d));
  }
  return keys;
}

function zeroSeries(keys: string[]): number[] {
  return keys.map(() => 0);
}

function chartFallbackForRange(
  range: ChartRangeOption,
): Pick<
  OverviewStats,
  "chartRange" | "chartBucket" | "chartKeys" | "chartViews" | "chartImpressions" | "chartPublished"
> {
  if (range === "7d") {
    const chartKeys = lastNDayKeysUtc(7);
    const z = zeroSeries(chartKeys);
    return {
      chartRange: "7d",
      chartBucket: "day",
      chartKeys,
      chartViews: z,
      chartImpressions: z,
      chartPublished: z,
    };
  }
  if (range === "1y") {
    const chartKeys = lastNUtcMonthKeys(12);
    const z = zeroSeries(chartKeys);
    return {
      chartRange: "1y",
      chartBucket: "month",
      chartKeys,
      chartViews: z,
      chartImpressions: z,
      chartPublished: z,
    };
  }
  if (range === "all") {
    const chartKeys = lastNUtcMonthKeys(1);
    const z = zeroSeries(chartKeys);
    return {
      chartRange: "all",
      chartBucket: "month",
      chartKeys,
      chartViews: z,
      chartImpressions: z,
      chartPublished: z,
    };
  }
  const chartKeys = lastNDayKeysUtc(30);
  const z = zeroSeries(chartKeys);
  return {
    chartRange: "30d",
    chartBucket: "day",
    chartKeys,
    chartViews: z,
    chartImpressions: z,
    chartPublished: z,
  };
}

export default async function DashboardHomePage({
  searchParams,
}: {
  searchParams: Promise<{ cr?: string }>;
}) {
  const sp = await searchParams;
  const chartRange = asChartRange(sp?.cr);

  const user = await fetchMeServer();
  if (!user) return null;

  const monthsUtc = lastNUtcMonthKeys(OVERVIEW_MONTHS);
  const zeros = zeroSeries(monthsUtc);
  const fallbackChart = chartFallbackForRange(chartRange);

  const overviewRes = await apiWithAuth(`/dashboard/overview?chartRange=${encodeURIComponent(chartRange)}`);
  let payload: OverviewPayload | null = overviewRes.ok ? ((await overviewRes.json()) as OverviewPayload) : null;

  if (!payload) {
    const [unreadRes, gridRes, draftsRes, promosRes] = await Promise.all([
      apiWithAuth("/notifications/unread-count"),
      apiWithAuth(`/posts/user/${user._id}/grid-stats`),
      apiWithAuth("/drafts/"),
      apiWithAuth("/promotions/mine"),
    ]);

    const unread = unreadRes.ok ? ((await unreadRes.json()) as UnreadRes) : { count: 0 };
    const grid = gridRes.ok ? ((await gridRes.json()) as GridStats) : {};
    const drafts = draftsRes.ok ? ((await draftsRes.json()) as DraftsRes) : { drafts: [] };
    const promosJson = promosRes.ok ? await promosRes.json().catch(() => ({})) : {};
    const promoList = Array.isArray((promosJson as { campaigns?: unknown[] }).campaigns)
      ? (promosJson as { campaigns: unknown[] }).campaigns
      : [];

    const draftCount = Array.isArray(drafts.drafts) ? drafts.drafts.length : 0;

    let chartBlock = fallbackChart;
    const chartOnly = await apiWithAuth(
      `/dashboard/overview/chart?chartRange=${encodeURIComponent(chartRange)}`,
    );
    if (chartOnly.ok) {
      const c = (await chartOnly.json()) as {
        chartRange?: string;
        chartBucket?: "day" | "month";
        chartKeys?: string[];
        chartViews?: number[];
        chartImpressions?: number[];
        chartPublished?: number[];
      };
      if (Array.isArray(c.chartKeys) && c.chartKeys.length > 0) {
        const zk = zeroSeries(c.chartKeys);
        chartBlock = {
          chartRange: asChartRange(c.chartRange ?? chartRange),
          chartBucket: c.chartBucket === "month" ? "month" : "day",
          chartKeys: c.chartKeys,
          chartViews: Array.isArray(c.chartViews) ? c.chartViews.map((v) => Number(v) || 0) : zk,
          chartImpressions: Array.isArray(c.chartImpressions) ? c.chartImpressions.map((v) => Number(v) || 0) : zk,
          chartPublished: Array.isArray(c.chartPublished) ? c.chartPublished.map((v) => Number(v) || 0) : zk,
        };
      }
    }

    payload = {
      postCount: grid.postCount ?? 0,
      reelCount: grid.reelCount ?? 0,
      gridTotal: grid.gridTotal ?? user.postsCount ?? 0,
      totalViews: grid.totalViews ?? 0,
      totalImpressions: grid.totalImpressions ?? 0,
      draftCount,
      promoCount: promoList.length,
      unreadCount: unread.count ?? 0,
      monthsUtc,
      viewsByMonth: zeros,
      impressionsByMonth: zeros,
      gridPublishedByMonth: zeros,
      draftsCreatedByMonth: zeros,
      promotionsCreatedByMonth: zeros,
      notificationsReceivedByMonth: zeros,
      ...chartBlock,
    };
  }

  const chartKeys = payload.chartKeys?.length ? payload.chartKeys : fallbackChart.chartKeys;
  const zChart = zeroSeries(chartKeys);

  const stats: OverviewStats = {
    gridTotal: payload.gridTotal ?? user.postsCount ?? 0,
    postCount: payload.postCount ?? 0,
    reelCount: payload.reelCount ?? 0,
    totalViews: payload.totalViews ?? 0,
    totalImpressions: Number(payload.totalImpressions) || 0,
    draftCount: payload.draftCount ?? 0,
    promoCount: payload.promoCount ?? 0,
    unreadCount: payload.unreadCount ?? 0,
    hasStore: Boolean(user.storeId),
    monthsUtc: payload.monthsUtc ?? monthsUtc,
    viewsByMonth: payload.viewsByMonth ?? zeros,
    impressionsByMonth: payload.impressionsByMonth ?? zeros,
    gridPublishedByMonth: payload.gridPublishedByMonth ?? zeros,
    draftsCreatedByMonth: payload.draftsCreatedByMonth ?? zeros,
    promotionsCreatedByMonth: payload.promotionsCreatedByMonth ?? zeros,
    notificationsReceivedByMonth: payload.notificationsReceivedByMonth ?? zeros,
    chartRange,
    chartBucket: chartRange === "1y" || chartRange === "all" ? "month" : "day",
    chartKeys,
    chartViews: payload.chartViews ?? zChart,
    chartImpressions: payload.chartImpressions ?? zChart,
    chartPublished: payload.chartPublished ?? zChart,
  };

  return <DashboardOverview stats={stats} />;
}
