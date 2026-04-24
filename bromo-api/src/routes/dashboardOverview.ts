import { Router, type Response } from "express";
import mongoose from "mongoose";
import {
  requireFirebaseToken,
  type FirebaseAuthedRequest,
} from "../middleware/firebaseAuth.js";
import { Post } from "../models/Post.js";
import { Draft } from "../models/Draft.js";
import { PromotionCampaign } from "../models/PromotionCampaign.js";
import { Notification } from "../models/Notification.js";
import { User } from "../models/User.js";

export const dashboardOverviewRouter = Router();

export type ChartRange = "7d" | "30d" | "1y" | "all";

/**
 * Same visibility as GET /posts/user/:id/grid-stats for the profile owner
 * (grid + saved; hide failed encodes and soft-deleted).
 */
const PROFILE_OR_SAVED_POST = {
  isDeleted: { $ne: true },
  processingStatus: { $nin: ["failed"] },
} as const;

const SPARKLINE_MONTHS = 24;
const ALL_TIME_MONTH_CAP = 120;

function utcMonthKey(y: number, m: number): string {
  return `${y}-${String(m).padStart(2, "0")}`;
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function utcDateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function lastNUtcMonthKeys(n: number): { keys: string[]; start: Date } {
  const now = new Date();
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push(utcMonthKey(d.getUTCFullYear(), d.getUTCMonth() + 1));
  }
  const [ys, ms] = keys[0]!.split("-");
  const start = new Date(Date.UTC(Number(ys), Number(ms) - 1, 1));
  return { keys, start };
}

function monthSeriesFromRows(
  keys: string[],
  rows: Array<{
    _id: { y: number; m: number };
    views?: number;
    impressions?: number;
    published?: number;
    n?: number;
  }>,
  pick: (r: (typeof rows)[number]) => number,
): number[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const y = Number((r._id as { y?: unknown }).y);
    const m = Number((r._id as { m?: unknown }).m);
    if (!Number.isFinite(y) || !Number.isFinite(m)) continue;
    const k = utcMonthKey(y, m);
    map.set(k, (map.get(k) ?? 0) + pick(r));
  }
  return keys.map((k) => map.get(k) ?? 0);
}

function daySeriesFromRows(
  keys: string[],
  rows: Array<{ _id: string; views?: number; impressions?: number; published?: number }>,
  pick: (r: (typeof rows)[number]) => number,
): number[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const dayKey = typeof r._id === "string" ? r._id.trim() : String(r._id ?? "").trim();
    if (!dayKey) continue;
    map.set(dayKey, (map.get(dayKey) ?? 0) + pick(r));
  }
  return keys.map((k) => map.get(k) ?? 0);
}

function enumerateUtcMonthsClosed(minY: number, minM: number, maxY: number, maxM: number, cap: number): string[] {
  const keys: string[] = [];
  let y = minY;
  let m = minM;
  while ((y < maxY || (y === maxY && m <= maxM)) && keys.length < cap) {
    keys.push(utcMonthKey(y, m));
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return keys;
}

export function parseChartRange(raw: unknown): ChartRange {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (s === "7d" || s === "7") return "7d";
  if (s === "30d" || s === "1m" || s === "month") return "30d";
  if (s === "1y" || s === "12m" || s === "year") return "1y";
  if (s === "all" || s === "alltime" || s === "all-time") return "all";
  return "30d";
}

export type PerformanceChartBlock = {
  chartRange: ChartRange;
  chartBucket: "day" | "month";
  chartKeys: string[];
  chartViews: number[];
  chartImpressions: number[];
  chartPublished: number[];
};

async function buildPerformanceChart(
  matchGrid: Record<string, unknown>,
  range: ChartRange,
): Promise<PerformanceChartBlock> {
  if (range === "7d" || range === "30d") {
    const n = range === "7d" ? 7 : 30;
    const today = startOfUtcDay(new Date());
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - (n - 1));
    const keys: string[] = [];
    for (let i = 0; i < n; i++) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      keys.push(utcDateKey(d));
    }
    const endExclusive = new Date(today);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

    const rows = await Post.aggregate([
      {
        $match: {
          ...matchGrid,
          createdAt: { $gte: start, $lt: endExclusive },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" },
          },
          views: { $sum: { $ifNull: ["$viewsCount", 0] } },
          impressions: { $sum: { $ifNull: ["$impressionsCount", 0] } },
          published: { $sum: 1 },
        },
      },
    ]);

    const typed = rows as Array<{ _id: string; views?: number; impressions?: number; published?: number }>;
    return {
      chartRange: range,
      chartBucket: "day",
      chartKeys: keys,
      chartViews: daySeriesFromRows(keys, typed, (r) => Number(r.views) || 0),
      chartImpressions: daySeriesFromRows(keys, typed, (r) => Number(r.impressions) || 0),
      chartPublished: daySeriesFromRows(keys, typed, (r) => Number(r.published) || 0),
    };
  }

  if (range === "1y") {
    const { keys } = lastNUtcMonthKeys(12);
    const rows = await Post.aggregate([
      { $match: matchGrid },
      {
        $group: {
          _id: {
            y: { $year: { date: "$createdAt", timezone: "UTC" } },
            m: { $month: { date: "$createdAt", timezone: "UTC" } },
          },
          views: { $sum: { $ifNull: ["$viewsCount", 0] } },
          impressions: { $sum: { $ifNull: ["$impressionsCount", 0] } },
          published: { $sum: 1 },
        },
      },
    ]);
    const typed = rows as Array<{
      _id: { y: number; m: number };
      views?: number;
      impressions?: number;
      published?: number;
    }>;
    return {
      chartRange: range,
      chartBucket: "month",
      chartKeys: keys,
      chartViews: monthSeriesFromRows(keys, typed, (r) => Number(r.views) || 0),
      chartImpressions: monthSeriesFromRows(keys, typed, (r) => Number(r.impressions) || 0),
      chartPublished: monthSeriesFromRows(keys, typed, (r) => Number(r.published) || 0),
    };
  }

  const rows = await Post.aggregate([
    { $match: matchGrid },
    {
      $group: {
        _id: {
          y: { $year: { date: "$createdAt", timezone: "UTC" } },
          m: { $month: { date: "$createdAt", timezone: "UTC" } },
        },
        views: { $sum: { $ifNull: ["$viewsCount", 0] } },
        impressions: { $sum: { $ifNull: ["$impressionsCount", 0] } },
        published: { $sum: 1 },
      },
    },
  ]);
  const typed = rows as Array<{
    _id: { y: number; m: number };
    views?: number;
    impressions?: number;
    published?: number;
  }>;

  if (!typed.length) {
    const now = new Date();
    const k = utcMonthKey(now.getUTCFullYear(), now.getUTCMonth() + 1);
    return {
      chartRange: "all",
      chartBucket: "month",
      chartKeys: [k],
      chartViews: [0],
      chartImpressions: [0],
      chartPublished: [0],
    };
  }

  let minY = typed[0]!._id.y;
  let minM = typed[0]!._id.m;
  let maxY = minY;
  let maxM = minM;
  for (const r of typed) {
    const { y, m } = r._id;
    if (y < minY || (y === minY && m < minM)) {
      minY = y;
      minM = m;
    }
    if (y > maxY || (y === maxY && m > maxM)) {
      maxY = y;
      maxM = m;
    }
  }
  const now = new Date();
  const curY = now.getUTCFullYear();
  const curM = now.getUTCMonth() + 1;
  let endY = maxY;
  let endM = maxM;
  if (curY > endY || (curY === endY && curM > endM)) {
    endY = curY;
    endM = curM;
  }

  const keys = enumerateUtcMonthsClosed(minY, minM, endY, endM, ALL_TIME_MONTH_CAP);
  return {
    chartRange: "all",
    chartBucket: "month",
    chartKeys: keys,
    chartViews: monthSeriesFromRows(keys, typed, (r) => Number(r.views) || 0),
    chartImpressions: monthSeriesFromRows(keys, typed, (r) => Number(r.impressions) || 0),
    chartPublished: monthSeriesFromRows(keys, typed, (r) => Number(r.published) || 0),
  };
}

dashboardOverviewRouter.get(
  "/overview/chart",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    if (!req.dbUser) return res.status(401).json({ message: "Unauthorized" });
    try {
      const range = parseChartRange(req.query.chartRange);
      const authorIdFilter = mongoose.Types.ObjectId.isValid(String(req.dbUser._id))
        ? new mongoose.Types.ObjectId(String(req.dbUser._id))
        : req.dbUser._id;
      const base = { authorId: authorIdFilter, ...PROFILE_OR_SAVED_POST };
      const matchGrid = { ...base, type: { $in: ["post", "reel"] as const } };
      const chart = await buildPerformanceChart(matchGrid, range);
      return res.json(chart);
    } catch (err) {
      console.error("[dashboard] chart error:", err);
      return res.status(500).json({ message: "Failed to load performance chart" });
    }
  },
);

dashboardOverviewRouter.get(
  "/overview",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    if (!req.dbUser) return res.status(401).json({ message: "Unauthorized" });
    try {
      const uid = req.dbUser._id;
      const authorIdFilter = mongoose.Types.ObjectId.isValid(String(uid))
        ? new mongoose.Types.ObjectId(String(uid))
        : uid;

      const base = { authorId: authorIdFilter, ...PROFILE_OR_SAVED_POST };
      const matchGrid = { ...base, type: { $in: ["post", "reel"] as const } };
      const chartRange = parseChartRange(req.query.chartRange);
      const { keys, start } = lastNUtcMonthKeys(SPARKLINE_MONTHS);

      const [
        postCount,
        reelCount,
        aggTotals,
        postMonthlyRows,
        draftMonthlyRows,
        promoMonthlyRows,
        notifMonthlyRows,
        draftCount,
        promoCount,
        unreadCount,
        chart,
      ] = await Promise.all([
        Post.countDocuments({ ...base, type: "post" }),
        Post.countDocuments({ ...base, type: "reel" }),
        Post.aggregate([
          { $match: matchGrid },
          {
            $group: {
              _id: null as null,
              totalViews: { $sum: { $ifNull: ["$viewsCount", 0] } },
              totalImpressions: { $sum: { $ifNull: ["$impressionsCount", 0] } },
            },
          },
        ]),
        Post.aggregate([
          { $match: matchGrid },
          {
            $group: {
              _id: {
                y: { $year: { date: "$createdAt", timezone: "UTC" } },
                m: { $month: { date: "$createdAt", timezone: "UTC" } },
              },
              views: { $sum: { $ifNull: ["$viewsCount", 0] } },
              impressions: { $sum: { $ifNull: ["$impressionsCount", 0] } },
              published: { $sum: 1 },
            },
          },
        ]),
        Draft.aggregate([
          { $match: { userId: authorIdFilter, createdAt: { $gte: start } } },
          {
            $group: {
              _id: {
                y: { $year: { date: "$createdAt", timezone: "UTC" } },
                m: { $month: { date: "$createdAt", timezone: "UTC" } },
              },
              n: { $sum: 1 },
            },
          },
        ]),
        PromotionCampaign.aggregate([
          { $match: { ownerUserId: authorIdFilter, createdAt: { $gte: start } } },
          {
            $group: {
              _id: {
                y: { $year: { date: "$createdAt", timezone: "UTC" } },
                m: { $month: { date: "$createdAt", timezone: "UTC" } },
              },
              n: { $sum: 1 },
            },
          },
        ]),
        Notification.aggregate([
          { $match: { recipientId: authorIdFilter, createdAt: { $gte: start } } },
          {
            $group: {
              _id: {
                y: { $year: { date: "$createdAt", timezone: "UTC" } },
                m: { $month: { date: "$createdAt", timezone: "UTC" } },
              },
              n: { $sum: 1 },
            },
          },
        ]),
        Draft.countDocuments({ userId: authorIdFilter }),
        PromotionCampaign.countDocuments({ ownerUserId: authorIdFilter }),
        Notification.countDocuments({ recipientId: authorIdFilter, read: false }),
        buildPerformanceChart(matchGrid, chartRange),
      ]);

      const totals = aggTotals[0] as { totalViews?: number; totalImpressions?: number } | undefined;
      const gridTotal = postCount + reelCount;

      void User.updateOne({ _id: authorIdFilter }, { $set: { postsCount: gridTotal } }).catch(() => null);

      const viewsByMonth = monthSeriesFromRows(keys, postMonthlyRows, (r) => Number(r.views) || 0);
      const impressionsByMonth = monthSeriesFromRows(keys, postMonthlyRows, (r) => Number(r.impressions) || 0);
      const gridPublishedByMonth = monthSeriesFromRows(keys, postMonthlyRows, (r) => Number(r.published) || 0);
      const draftsCreatedByMonth = monthSeriesFromRows(keys, draftMonthlyRows, (r) => Number(r.n) || 0);
      const promotionsCreatedByMonth = monthSeriesFromRows(keys, promoMonthlyRows, (r) => Number(r.n) || 0);
      const notificationsReceivedByMonth = monthSeriesFromRows(keys, notifMonthlyRows, (r) => Number(r.n) || 0);

      return res.json({
        postCount,
        reelCount,
        gridTotal,
        totalViews: Number(totals?.totalViews) || 0,
        totalImpressions: Number(totals?.totalImpressions) || 0,
        draftCount,
        promoCount,
        unreadCount,
        monthsUtc: keys,
        viewsByMonth,
        impressionsByMonth,
        gridPublishedByMonth,
        draftsCreatedByMonth,
        promotionsCreatedByMonth,
        notificationsReceivedByMonth,
        ...chart,
      });
    } catch (err) {
      console.error("[dashboard] overview error:", err);
      return res.status(500).json({ message: "Failed to load dashboard overview" });
    }
  },
);
