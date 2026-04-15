import { Router, type Response } from "express";
import mongoose from "mongoose";
import { Ad } from "../models/Ad.js";
import { AdEvent } from "../models/AdEvent.js";
import { requireAdminToken, type AuthedRequest } from "../middleware/authBearer.js";

export const adsAdminRouter = Router();

// ─── List ads ────────────────────────────────────────────────────────────────
adsAdminRouter.get("/", requireAdminToken, async (req: AuthedRequest, res: Response) => {
  const { status, page = "1", limit = "20", search } = req.query as Record<string, string>;
  const filter: Record<string, unknown> = {};
  if (status && status !== "all") filter.status = status;
  if (search) filter.title = { $regex: search, $options: "i" };

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
  const skip = (pageNum - 1) * limitNum;

  const [ads, total] = await Promise.all([
    Ad.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    Ad.countDocuments(filter),
  ]);

  res.json({ ads, total, page: pageNum, hasMore: skip + ads.length < total });
});

// ─── Create ad ───────────────────────────────────────────────────────────────
adsAdminRouter.post("/", requireAdminToken, async (req: AuthedRequest, res: Response) => {
  const admin = req.admin!;
  const { title, adType, mediaUrls, thumbnailUrl, caption, cta, placements, startDate, endDate, priority, status } = req.body as Record<string, unknown>;

  if (!title || !adType || !Array.isArray(mediaUrls) || !mediaUrls.length || !cta || !Array.isArray(placements) || !placements.length || !startDate) {
    res.status(400).json({ message: "Missing required fields: title, adType, mediaUrls, cta, placements, startDate" });
    return;
  }

  const validStatuses = ["draft", "active"];
  const ad = await Ad.create({
    title,
    adType,
    mediaUrls,
    thumbnailUrl: thumbnailUrl ?? "",
    caption: caption ?? "",
    cta,
    placements,
    startDate: new Date(startDate as string),
    endDate: endDate ? new Date(endDate as string) : undefined,
    priority: priority ?? 1,
    status: validStatuses.includes(status as string) ? status : "draft",
    createdBy: new mongoose.Types.ObjectId(admin.id),
  });

  res.status(201).json({ ad });
});

// ─── Get single ad ───────────────────────────────────────────────────────────
adsAdminRouter.get("/:id", requireAdminToken, async (req: AuthedRequest, res: Response) => {
  const ad = await Ad.findById(req.params.id).lean();
  if (!ad) { res.status(404).json({ message: "Ad not found" }); return; }
  res.json({ ad });
});

// ─── Update ad ───────────────────────────────────────────────────────────────
adsAdminRouter.patch("/:id", requireAdminToken, async (req: AuthedRequest, res: Response) => {
  const { title, adType, mediaUrls, thumbnailUrl, caption, cta, placements, startDate, endDate, priority } = req.body as Record<string, unknown>;
  const update: Record<string, unknown> = {};

  if (title !== undefined) update.title = title;
  if (adType !== undefined) update.adType = adType;
  if (mediaUrls !== undefined) update.mediaUrls = mediaUrls;
  if (thumbnailUrl !== undefined) update.thumbnailUrl = thumbnailUrl;
  if (caption !== undefined) update.caption = caption;
  if (cta !== undefined) update.cta = cta;
  if (placements !== undefined) update.placements = placements;
  if (startDate !== undefined) update.startDate = new Date(startDate as string);
  if (endDate !== undefined) update.endDate = endDate ? new Date(endDate as string) : null;
  if (priority !== undefined) update.priority = priority;

  const ad = await Ad.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true }).lean();
  if (!ad) { res.status(404).json({ message: "Ad not found" }); return; }
  res.json({ ad });
});

// ─── Update ad status ────────────────────────────────────────────────────────
adsAdminRouter.patch("/:id/status", requireAdminToken, async (req: AuthedRequest, res: Response) => {
  const { status } = req.body as { status?: string };
  const valid = ["draft", "active", "paused", "archived"];
  if (!status || !valid.includes(status)) {
    res.status(400).json({ message: `status must be one of: ${valid.join(", ")}` });
    return;
  }

  const ad = await Ad.findByIdAndUpdate(req.params.id, { $set: { status } }, { new: true }).lean();
  if (!ad) { res.status(404).json({ message: "Ad not found" }); return; }
  res.json({ ad });
});

// ─── Delete ad (soft — archive) ───────────────────────────────────────────────
adsAdminRouter.delete("/:id", requireAdminToken, async (req: AuthedRequest, res: Response) => {
  const ad = await Ad.findByIdAndUpdate(req.params.id, { $set: { status: "archived" } }, { new: true }).lean();
  if (!ad) { res.status(404).json({ message: "Ad not found" }); return; }
  res.json({ message: "Ad archived", ad });
});

// ─── Analytics ───────────────────────────────────────────────────────────────
adsAdminRouter.get("/:id/analytics", requireAdminToken, async (req: AuthedRequest, res: Response) => {
  const adId = new mongoose.Types.ObjectId(req.params.id as string);
  const ad = await Ad.findById(adId).lean();
  if (!ad) { res.status(404).json({ message: "Ad not found" }); return; }

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Daily impressions + clicks breakdown (last 30 days)
  const dailyRaw = await AdEvent.aggregate([
    { $match: { adId, createdAt: { $gte: since } } },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          event: "$event",
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.date": 1 } },
  ]);

  const dailyMap: Record<string, { impressions: number; clicks: number }> = {};
  for (const row of dailyRaw) {
    const d = row._id.date as string;
    if (!dailyMap[d]) dailyMap[d] = { impressions: 0, clicks: 0 };
    if (row._id.event === "impression") dailyMap[d].impressions += row.count as number;
    if (row._id.event === "click") dailyMap[d].clicks += row.count as number;
  }
  const dailyBreakdown = Object.entries(dailyMap).map(([date, v]) => ({ date, ...v }));

  // By-placement breakdown
  const placementRaw = await AdEvent.aggregate([
    { $match: { adId, event: { $in: ["impression", "click"] } } },
    {
      $group: {
        _id: { placement: "$placement", event: "$event" },
        count: { $sum: 1 },
      },
    },
  ]);

  const placementMap: Record<string, { impressions: number; clicks: number }> = {};
  for (const row of placementRaw) {
    const p = row._id.placement as string;
    if (!placementMap[p]) placementMap[p] = { impressions: 0, clicks: 0 };
    if (row._id.event === "impression") placementMap[p].impressions += row.count as number;
    if (row._id.event === "click") placementMap[p].clicks += row.count as number;
  }

  const ctr = ad.totalImpressions > 0 ? ad.totalClicks / ad.totalImpressions : 0;
  const completionRate = ad.totalVideoViews > 0 ? ad.totalVideoCompletions / ad.totalVideoViews : 0;
  const avgWatchTimeMs = ad.totalVideoViews > 0 ? ad.totalWatchTimeMs / ad.totalVideoViews : 0;

  res.json({
    summary: {
      totalImpressions: ad.totalImpressions,
      totalClicks: ad.totalClicks,
      ctr: Math.round(ctr * 10000) / 100, // percent, 2dp
      totalVideoViews: ad.totalVideoViews,
      totalVideoCompletions: ad.totalVideoCompletions,
      completionRate: Math.round(completionRate * 10000) / 100,
      avgWatchTimeMs: Math.round(avgWatchTimeMs),
    },
    byPlacement: placementMap,
    dailyBreakdown,
  });
});
