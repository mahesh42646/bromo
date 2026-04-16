import { Router, type Response } from "express";
import mongoose from "mongoose";
import { Ad } from "../models/Ad.js";
import { AdEvent } from "../models/AdEvent.js";
import { AdEngagement } from "../models/AdEngagement.js";
import { Like } from "../models/Like.js";
import { Follow } from "../models/Follow.js";
import { Post } from "../models/Post.js";
import {
  requireFirebaseToken,
  requireVerifiedUser,
  type FirebaseAuthedRequest,
} from "../middleware/firebaseAuth.js";

export const adServeRouter = Router();

const VALID_PLACEMENTS = new Set(["feed", "reels", "stories", "explore"]);
const FREQUENCY_CAP_WINDOW_MS = 24 * 60 * 60 * 1000;

function normalizeCategory(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

async function getViewerInterestScores(viewerId: mongoose.Types.ObjectId): Promise<Map<string, number>> {
  const scores = new Map<string, number>();
  const add = (category: string, weight: number) => {
    if (!category) return;
    scores.set(category, (scores.get(category) ?? 0) + weight);
  };

  const likes = await Like.find({ userId: viewerId, targetType: "post" })
    .sort({ createdAt: -1 })
    .limit(120)
    .select("targetId")
    .lean();
  if (likes.length) {
    const likedPosts = await Post.find({ _id: { $in: likes.map((l) => l.targetId) } })
      .select("feedCategory")
      .lean();
    likedPosts.forEach((p) => add(normalizeCategory((p as { feedCategory?: unknown }).feedCategory), 4));
  }

  const follows = await Follow.find({ followerId: viewerId, status: "accepted" })
    .sort({ createdAt: -1 })
    .limit(150)
    .select("followingId")
    .lean();
  if (follows.length) {
    const followedPosts = await Post.find({
      authorId: { $in: follows.map((f) => f.followingId) },
      isActive: true,
      isDeleted: { $ne: true },
    })
      .sort({ createdAt: -1 })
      .limit(150)
      .select("feedCategory")
      .lean();
    followedPosts.forEach((p) => add(normalizeCategory((p as { feedCategory?: unknown }).feedCategory), 2));
  }

  const adEngagements = await AdEngagement.find({
    userId: viewerId,
    $or: [{ likedAt: { $exists: true } }, { savedAt: { $exists: true } }, { sharedAt: { $exists: true } }],
  })
    .sort({ updatedAt: -1 })
    .limit(80)
    .select("adId likedAt savedAt sharedAt")
    .lean();
  if (adEngagements.length) {
    const adMap = new Map(
      (
        await Ad.find({ _id: { $in: adEngagements.map((e) => e.adId) } })
          .select("category")
          .lean()
      ).map((a) => [String(a._id), normalizeCategory((a as { category?: unknown }).category)]),
    );
    adEngagements.forEach((e) => {
      const category = adMap.get(String(e.adId)) ?? "";
      if (!category) return;
      if (e.savedAt) add(category, 5);
      if (e.likedAt) add(category, 3);
      if (e.sharedAt) add(category, 2);
    });
  }

  return scores;
}

// ─── Serve active ads for a placement ────────────────────────────────────────
adServeRouter.get("/serve", requireFirebaseToken, async (req: FirebaseAuthedRequest, res: Response) => {
  const { placement, limit = "3" } = req.query as Record<string, string>;

  if (!placement || !VALID_PLACEMENTS.has(placement)) {
    res.status(400).json({ message: "placement must be one of: feed, reels, stories, explore" });
    return;
  }

  const limitNum = Math.min(10, Math.max(1, parseInt(limit)));
  const now = new Date();
  const viewerId = req.dbUser?._id;
  const since = new Date(Date.now() - FREQUENCY_CAP_WINDOW_MS);

  let blockedAdIds: mongoose.Types.ObjectId[] = [];
  let interestScores = new Map<string, number>();
  if (viewerId) {
    const [recentImpressions, scores] = await Promise.all([
      AdEvent.find({
        userId: viewerId,
        event: "impression",
        createdAt: { $gte: since },
      })
        .select("adId")
        .lean(),
      getViewerInterestScores(viewerId),
    ]);
    blockedAdIds = recentImpressions.map((e) => e.adId);
    interestScores = scores;
  }

  const ads = await Ad.find({
    status: "active",
    placements: placement,
    ...(blockedAdIds.length ? { _id: { $nin: blockedAdIds } } : {}),
    startDate: { $lte: now },
    $or: [{ endDate: { $gt: now } }, { endDate: null }, { endDate: { $exists: false } }],
  })
    .sort({ priority: -1, createdAt: -1 })
    .limit(limitNum * 3)
    .select("adType mediaUrls thumbnailUrl caption cta placements brandName category priority createdAt")
    .lean();

  const scored = (ads as Array<AdWithPriority & { category?: string; createdAt?: Date }>).map((ad) => {
    const category = normalizeCategory(ad.category);
    const score = (ad.priority ?? 1) * 100 + (interestScores.get(category) ?? 0) * 25;
    return { ad, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const ranked = scored.map((x) => x.ad);
  const shuffled = shuffleWithinPriority(ranked);
  res.json({ ads: shuffled.slice(0, limitNum) });
});

// ─── Track ad event ───────────────────────────────────────────────────────────
adServeRouter.post("/:id/event", requireFirebaseToken, async (req: FirebaseAuthedRequest, res: Response) => {
  const { event, placement, watchTimeMs } = req.body as Record<string, unknown>;

  if (!event || !placement) {
    res.status(400).json({ message: "event and placement are required" });
    return;
  }

  const validEvents = ["impression", "click", "video_view", "video_complete"];
  if (!validEvents.includes(event as string)) {
    res.status(400).json({ message: `event must be one of: ${validEvents.join(", ")}` });
    return;
  }

  if (!VALID_PLACEMENTS.has(placement as string)) {
    res.status(400).json({ message: "invalid placement" });
    return;
  }

  let adObjectId: mongoose.Types.ObjectId;
  try {
    adObjectId = new mongoose.Types.ObjectId(String(req.params.id));
  } catch {
    res.status(400).json({ message: "invalid ad id" });
    return;
  }

  const counterMap: Record<string, string> = {
    impression: "totalImpressions",
    click: "totalClicks",
    video_view: "totalVideoViews",
    video_complete: "totalVideoCompletions",
  };

  const incField = counterMap[event as string];
  const incPayload: Record<string, number> = { [incField]: 1 };
  if (event === "video_view" && typeof watchTimeMs === "number") {
    incPayload.totalWatchTimeMs = Math.round(watchTimeMs);
  }

  const adExists = await Ad.exists({ _id: adObjectId, status: "active" });
  if (!adExists) {
    res.status(404).json({ message: "Ad not found or not active" });
    return;
  }

  const userId = req.dbUser?._id;
  if (userId && (event === "impression" || event === "click")) {
    const capSince = new Date(Date.now() - FREQUENCY_CAP_WINDOW_MS);
    const duplicate = await AdEvent.exists({
      adId: adObjectId,
      userId,
      event,
      createdAt: { $gte: capSince },
    });
    if (duplicate) {
      res.json({ ok: true, deduped: true });
      return;
    }
  }

  Promise.all([
    AdEvent.create({
      adId: adObjectId,
      userId,
      event,
      placement,
      watchTimeMs: typeof watchTimeMs === "number" ? Math.round(watchTimeMs) : undefined,
    }),
    Ad.updateOne({ _id: adObjectId }, { $inc: incPayload }),
  ]).catch(() => null);

  res.json({ ok: true });
});

// ─── GET /ads/:id/summary ─────────────────────────────────────────────────────
adServeRouter.get("/:id/summary", requireFirebaseToken, async (req: FirebaseAuthedRequest, res: Response) => {
  let adObjectId: mongoose.Types.ObjectId;
  try {
    adObjectId = new mongoose.Types.ObjectId(String(req.params.id));
  } catch {
    res.status(400).json({ message: "invalid ad id" });
    return;
  }

  const ad = await Ad.findById(adObjectId)
    .select("likesCount sharesCount savesCount totalImpressions totalClicks totalVideoViews totalVideoCompletions")
    .lean();
  if (!ad) {
    res.status(404).json({ message: "Ad not found" });
    return;
  }

  let liked = false;
  let saved = false;
  if (req.dbUser?._id) {
    const eng = await AdEngagement.findOne({ adId: adObjectId, userId: req.dbUser._id })
      .select("likedAt savedAt")
      .lean();
    liked = Boolean(eng?.likedAt);
    saved = Boolean(eng?.savedAt);
  }

  res.json({
    likesCount: ad.likesCount,
    sharesCount: ad.sharesCount,
    savesCount: ad.savesCount,
    impressions: ad.totalImpressions,
    clicks: ad.totalClicks,
    videoViews: ad.totalVideoViews,
    videoCompletions: ad.totalVideoCompletions,
    liked,
    saved,
  });
});

// ─── POST /ads/:id/like ───────────────────────────────────────────────────────
adServeRouter.post("/:id/like", requireVerifiedUser, async (req: FirebaseAuthedRequest, res: Response) => {
  let adObjectId: mongoose.Types.ObjectId;
  try {
    adObjectId = new mongoose.Types.ObjectId(String(req.params.id));
  } catch {
    res.status(400).json({ message: "invalid ad id" });
    return;
  }

  const adExists = await Ad.exists({ _id: adObjectId });
  if (!adExists) {
    res.status(404).json({ message: "Ad not found" });
    return;
  }

  const eng = await AdEngagement.findOne({ adId: adObjectId, userId: req.dbUser!._id });
  if (eng?.likedAt) {
    const ad = await Ad.findById(adObjectId).select("likesCount").lean();
    res.json({ liked: true, likesCount: ad?.likesCount ?? 0 });
    return;
  }

  await AdEngagement.findOneAndUpdate(
    { adId: adObjectId, userId: req.dbUser!._id },
    { $set: { likedAt: new Date() } },
    { upsert: true },
  );
  const updated = await Ad.findByIdAndUpdate(
    adObjectId,
    { $inc: { likesCount: 1 } },
    { new: true, select: "likesCount" },
  ).lean();

  res.json({ liked: true, likesCount: updated?.likesCount ?? 0 });
});

// ─── DELETE /ads/:id/like ─────────────────────────────────────────────────────
adServeRouter.delete("/:id/like", requireVerifiedUser, async (req: FirebaseAuthedRequest, res: Response) => {
  let adObjectId: mongoose.Types.ObjectId;
  try {
    adObjectId = new mongoose.Types.ObjectId(String(req.params.id));
  } catch {
    res.status(400).json({ message: "invalid ad id" });
    return;
  }

  const eng = await AdEngagement.findOne({ adId: adObjectId, userId: req.dbUser!._id });
  if (!eng?.likedAt) {
    const ad = await Ad.findById(adObjectId).select("likesCount").lean();
    res.json({ liked: false, likesCount: ad?.likesCount ?? 0 });
    return;
  }

  await AdEngagement.updateOne({ adId: adObjectId, userId: req.dbUser!._id }, { $unset: { likedAt: 1 } });
  const updated = await Ad.findByIdAndUpdate(
    adObjectId,
    { $inc: { likesCount: -1 } },
    { new: true, select: "likesCount" },
  ).lean();

  res.json({ liked: false, likesCount: Math.max(0, updated?.likesCount ?? 0) });
});

// ─── POST /ads/:id/save ───────────────────────────────────────────────────────
adServeRouter.post("/:id/save", requireVerifiedUser, async (req: FirebaseAuthedRequest, res: Response) => {
  let adObjectId: mongoose.Types.ObjectId;
  try {
    adObjectId = new mongoose.Types.ObjectId(String(req.params.id));
  } catch {
    res.status(400).json({ message: "invalid ad id" });
    return;
  }

  const adExists = await Ad.exists({ _id: adObjectId });
  if (!adExists) {
    res.status(404).json({ message: "Ad not found" });
    return;
  }

  const eng = await AdEngagement.findOne({ adId: adObjectId, userId: req.dbUser!._id });
  if (eng?.savedAt) {
    const ad = await Ad.findById(adObjectId).select("savesCount").lean();
    res.json({ saved: true, savesCount: ad?.savesCount ?? 0 });
    return;
  }

  await AdEngagement.findOneAndUpdate(
    { adId: adObjectId, userId: req.dbUser!._id },
    { $set: { savedAt: new Date() } },
    { upsert: true },
  );
  const updated = await Ad.findByIdAndUpdate(
    adObjectId,
    { $inc: { savesCount: 1 } },
    { new: true, select: "savesCount" },
  ).lean();

  res.json({ saved: true, savesCount: updated?.savesCount ?? 0 });
});

// ─── DELETE /ads/:id/save ─────────────────────────────────────────────────────
adServeRouter.delete("/:id/save", requireVerifiedUser, async (req: FirebaseAuthedRequest, res: Response) => {
  let adObjectId: mongoose.Types.ObjectId;
  try {
    adObjectId = new mongoose.Types.ObjectId(String(req.params.id));
  } catch {
    res.status(400).json({ message: "invalid ad id" });
    return;
  }

  const eng = await AdEngagement.findOne({ adId: adObjectId, userId: req.dbUser!._id });
  if (!eng?.savedAt) {
    const ad = await Ad.findById(adObjectId).select("savesCount").lean();
    res.json({ saved: false, savesCount: ad?.savesCount ?? 0 });
    return;
  }

  await AdEngagement.updateOne({ adId: adObjectId, userId: req.dbUser!._id }, { $unset: { savedAt: 1 } });
  const updated = await Ad.findByIdAndUpdate(
    adObjectId,
    { $inc: { savesCount: -1 } },
    { new: true, select: "savesCount" },
  ).lean();

  res.json({ saved: false, savesCount: Math.max(0, updated?.savesCount ?? 0) });
});

// ─── POST /ads/:id/share ──────────────────────────────────────────────────────
adServeRouter.post("/:id/share", requireFirebaseToken, async (req: FirebaseAuthedRequest, res: Response) => {
  let adObjectId: mongoose.Types.ObjectId;
  try {
    adObjectId = new mongoose.Types.ObjectId(String(req.params.id));
  } catch {
    res.status(400).json({ message: "invalid ad id" });
    return;
  }

  const adExists = await Ad.exists({ _id: adObjectId });
  if (!adExists) {
    res.status(404).json({ message: "Ad not found" });
    return;
  }

  if (req.dbUser?._id) {
    AdEngagement.findOneAndUpdate(
      { adId: adObjectId, userId: req.dbUser._id },
      { $set: { sharedAt: new Date() } },
      { upsert: true },
    ).catch(() => null);
  }

  const updated = await Ad.findByIdAndUpdate(
    adObjectId,
    { $inc: { sharesCount: 1 } },
    { new: true, select: "sharesCount" },
  ).lean();

  res.json({ ok: true, sharesCount: updated?.sharesCount ?? 0 });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

type AdWithPriority = { priority?: number; [key: string]: unknown };

function shuffleWithinPriority(ads: AdWithPriority[]): AdWithPriority[] {
  if (ads.length <= 1) return ads;
  const groups = new Map<number, AdWithPriority[]>();
  for (const ad of ads) {
    const p = ad.priority ?? 1;
    if (!groups.has(p)) groups.set(p, []);
    groups.get(p)!.push(ad);
  }
  const result: AdWithPriority[] = [];
  for (const [, group] of [...groups.entries()].sort((a, b) => b[0] - a[0])) {
    result.push(...fisherYates(group));
  }
  return result;
}

function fisherYates<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
