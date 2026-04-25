import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Router, type Response } from "express";
import mongoose from "mongoose";
import {
  requireFirebaseToken,
  requireVerifiedUser,
  type FirebaseAuthedRequest,
} from "../middleware/firebaseAuth.js";
import { Post } from "../models/Post.js";
import { MediaJob } from "../models/MediaJob.js";
import { StorySeen } from "../models/StorySeen.js";
import { Like } from "../models/Like.js";
import { Comment } from "../models/Comment.js";
import { PostPollVote } from "../models/PostPollVote.js";
import { Follow } from "../models/Follow.js";
import { User } from "../models/User.js";
import { createNotification, checkLikeMilestone } from "../models/Notification.js";
import {
  emitPostNew,
  emitPostLike,
  emitPostComment,
  emitPostDelete,
  emitStoryNew,
  emitNotification,
} from "../services/socketService.js";
import { rewritePublicMediaUrl } from "../utils/publicMediaUrl.js";
import {
  publicUrlForUploadRelative,
  uploadRelativePathFromUrl,
  uploadsRoot,
} from "../utils/uploadFiles.js";
import { generateVideoThumbnail } from "../services/mediaProcessor.js";
import { enqueueMediaJob } from "../workers/mediaWorker.js";
import { authorPostsCountWasBumped } from "../utils/authorPostsCount.js";
import { normalizeFeedCategory } from "../utils/feedCategory.js";
import { PromotionCampaign } from "../models/PromotionCampaign.js";
import { ContentDeliveryLog } from "../models/ContentDeliveryLog.js";
import { LRUCache } from "lru-cache";
import { cacheGetJson, cacheSetJson } from "../services/cacheLayer.js";
import { isCanaryUser, perfFlags } from "../config/perfFlags.js";

export const postsRouter = Router();

type PerfEventBody = {
  event?: string;
  ts?: number;
  sessionId?: string;
  durationMs?: number;
  [key: string]: unknown;
};

postsRouter.post("/perf-event", requireFirebaseToken, async (req: FirebaseAuthedRequest, res: Response) => {
  const body = (req.body ?? {}) as PerfEventBody;
  if (!body.event || typeof body.event !== "string") {
    return res.status(400).json({ message: "event is required" });
  }
  const safe = {
    event: body.event,
    ts: typeof body.ts === "number" ? body.ts : Date.now(),
    sessionId: typeof body.sessionId === "string" ? body.sessionId : "unknown",
    userId: req.dbUser?._id ? String(req.dbUser._id) : "anon",
    durationMs: typeof body.durationMs === "number" ? body.durationMs : null,
  };
  console.info("[perf-event]", JSON.stringify(safe));
  return res.status(202).json({ accepted: true });
});

/** Batched view / watch-time (mobile scroll storm → one round-trip). */
postsRouter.post("/views/batch", requireFirebaseToken, async (req: FirebaseAuthedRequest, res: Response) => {
  const raw = (req.body as { items?: unknown }).items;
  if (!Array.isArray(raw)) {
    return res.status(400).json({ message: "items array required" });
  }
  type BatchItem = { postId?: string; watchMs?: number; impression?: boolean };
  const capped = (raw as BatchItem[]).slice(0, 40);
  const agg = new Map<string, { impression: boolean; watchMs: number }>();

  for (const it of capped) {
    const pid = String(it.postId ?? "");
    if (!mongoose.Types.ObjectId.isValid(pid)) continue;
    const w = Math.min(Math.max(0, Number(it.watchMs) || 0), 3_600_000);
    const explicitImp = it.impression === true;
    const cur = agg.get(pid) ?? { impression: false, watchMs: 0 };
    if (explicitImp) cur.impression = true;
    if (w > 0) cur.watchMs += w;
    if (w === 0 && it.impression !== false) cur.impression = true;
    agg.set(pid, cur);
  }

  const ops: mongoose.mongo.AnyBulkWriteOperation<mongoose.Document>[] = [];
  for (const [postId, v] of agg) {
    const inc: Record<string, number> = {};
    if (v.impression) {
      inc.viewsCount = 1;
      inc.impressionsCount = 1;
    }
    if (v.watchMs > 0) inc.totalWatchTimeMs = v.watchMs;
    if (Object.keys(inc).length === 0) continue;
    const oid = new mongoose.Types.ObjectId(postId);
    ops.push({
      updateOne: {
        filter: {_id: oid, isActive: true, isDeleted: {$ne: true}},
        update: {$inc: inc},
      },
    });
  }

  if (ops.length > 0) {
    try {
      await Post.bulkWrite(ops as Parameters<typeof Post.bulkWrite>[0], {ordered: false});
    } catch (err) {
      console.error("[posts] views/batch bulkWrite:", err);
      return res.status(500).json({ message: "Batch failed" });
    }
    for (const postId of agg.keys()) {
      Post.findById(postId)
        .select("viewsCount totalWatchTimeMs")
        .lean()
        .then((p) => {
          if (p && p.viewsCount > 0) {
            const avg = p.totalWatchTimeMs / p.viewsCount;
            return Post.updateOne({ _id: postId }, { $set: { avgWatchTimeMs: avg } });
          }
          return null;
        })
        .catch(() => null);
      recomputeTrending(postId);
    }
  }

  return res.json({ ok: true, n: agg.size });
});

type ReelPageResult = {posts: unknown[]; hasMore: boolean; nextCursor: string | null};
/** Per-user page-1 reel cache. Eliminates 3 DB round-trips on every reel screen open. */
const reelPageCache = new LRUCache<string, ReelPageResult>({
  max: 2000,
  ttl: 30_000, // 30-second freshness window
});

type FeedPageResult = {posts: unknown[]; hasMore: boolean};
/** Per-user per-category feed cache (page 1 only). */
const feedPageCache = new LRUCache<string, FeedPageResult>({
  max: 2000,
  ttl: 30_000,
});

const AUTHOR_SELECT = "username displayName profilePicture isPrivate emailVerified followersCount";
const DELIVERY_FREQ_CAP_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Public listings: active, not soft-deleted, and not still processing. */
const VISIBLE_POST = {
  isActive: true,
  isDeleted: { $ne: true },
  // Exclude posts still in the transcode pipeline; allow legacy posts with no processingStatus
  processingStatus: { $nin: ["pending", "processing", "failed"] },
} as const;

function activePromotionClause(now: Date) {
  return {
    status: "active" as const,
    startAt: { $lte: now },
    $or: [{ endAt: { $gt: now } }, { endAt: null }, { endAt: { $exists: false } }],
    $expr: { $lt: ["$spentCoins", "$budgetCoins"] },
  };
}

/** Match campaigns with no placements (treat as all surfaces) or overlapping placement keys. */
function campaignPlacementOr(placementKeys: string[]) {
  return {
    $or: [
      { audience: { $exists: false } },
      { "audience.placements": { $exists: false } },
      { "audience.placements": { $size: 0 } },
      { "audience.placements": { $in: placementKeys } },
    ],
  };
}

function normalizeCategory(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

const interestScoreCache = new LRUCache<string, Map<string, number>>({
  max: 500,
  ttl: 5 * 60 * 1000,
});

async function getViewerInterestScores(viewerId: mongoose.Types.ObjectId): Promise<Map<string, number>> {
  const key = String(viewerId);
  const cached = interestScoreCache.get(key);
  if (cached) return cached;

  const scores = new Map<string, number>();
  const add = (category: string, weight: number) => {
    if (!category) return;
    scores.set(category, (scores.get(category) ?? 0) + weight);
  };

  const [likedPosts, followedPosts] = await Promise.all([
    (async () => {
      const likes = await Like.find({ userId: viewerId, targetType: "post" })
        .sort({ createdAt: -1 })
        .limit(120)
        .select("targetId")
        .lean();
      if (!likes.length) return [];
      return Post.find({ _id: { $in: likes.map((l) => l.targetId) } })
        .select("feedCategory")
        .lean();
    })(),
    (async () => {
      const follows = await Follow.find({ followerId: viewerId, status: "accepted" })
        .sort({ createdAt: -1 })
        .limit(160)
        .select("followingId")
        .lean();
      if (!follows.length) return [];
      return Post.find({
        authorId: { $in: follows.map((f) => f.followingId) },
        ...VISIBLE_POST,
      })
        .sort({ createdAt: -1 })
        .limit(160)
        .select("feedCategory")
        .lean();
    })(),
  ]);

  likedPosts.forEach((p) => add(normalizeCategory((p as { feedCategory?: unknown }).feedCategory), 4));
  followedPosts.forEach((p) => add(normalizeCategory((p as { feedCategory?: unknown }).feedCategory), 2));

  interestScoreCache.set(key, scores);
  return scores;
}

/**
 * Promoted post docs for feed/explore/reels/stories injection.
 * Skips campaign owners the viewer already follows (they get organic delivery instead).
 */
async function getPromotedPostDocs(
  viewerId: mongoose.Types.ObjectId,
  excludeOwnerIds: mongoose.Types.ObjectId[],
  placementKeys: string[],
  limit: number,
  contentType?: "post" | "reel" | "story",
): Promise<Array<Record<string, unknown>>> {
  const now = new Date();
  const capSince = new Date(Date.now() - DELIVERY_FREQ_CAP_WINDOW_MS);
  const typeClause = contentType ? { contentType } : {};
  const [campaigns, recentImpressions, interestScores] = await Promise.all([
    PromotionCampaign.find({
      ...activePromotionClause(now),
      ...campaignPlacementOr(placementKeys),
      ...typeClause,
    })
      .sort({ createdAt: -1 })
      .limit(Math.max(limit * 8, 20))
      .lean(),
    ContentDeliveryLog.find({
      viewerId,
      deliveryKind: "impression",
      createdAt: { $gte: capSince },
      promotionId: { $exists: true },
    })
      .select("promotionId")
      .lean(),
    getViewerInterestScores(viewerId),
  ]);

  if (!campaigns.length) return [];

  const blockedPromotionIds = new Set(
    recentImpressions.map((x) => String((x as { promotionId?: unknown }).promotionId ?? "")),
  );
  const ex = new Set(excludeOwnerIds.map(String));
  const eligible = campaigns.filter(
    (c) => !ex.has(String(c.ownerUserId)) && !blockedPromotionIds.has(String(c._id)),
  );
  if (!eligible.length) return [];

  const postToCampaigns = new Map<string, typeof eligible>();
  for (const c of eligible) {
    const key = String(c.contentId);
    const arr = postToCampaigns.get(key) ?? [];
    arr.push(c);
    postToCampaigns.set(key, arr);
  }
  const postIds = [...postToCampaigns.keys()].map((id) => new mongoose.Types.ObjectId(id));
  if (!postIds.length) return [];

  const posts = await Post.find({
    _id: { $in: postIds },
    ...VISIBLE_POST,
  })
    .populate("authorId", AUTHOR_SELECT)
    .lean();

  const byId = new Map(posts.map((p) => [String(p._id), p]));
  const ranked: Array<{ campaign: (typeof eligible)[number]; score: number }> = [];
  for (const [postId, postCampaigns] of postToCampaigns.entries()) {
    const raw = byId.get(postId);
    if (!raw) continue;
    const category = normalizeCategory((raw as { feedCategory?: unknown }).feedCategory);
    const interestBoost = (interestScores.get(category) ?? 0) * 20;
    for (const campaign of postCampaigns) {
      ranked.push({
        campaign,
        score: interestBoost + new Date(campaign.createdAt).getTime() / 1_000_000_000_000,
      });
    }
  }
  ranked.sort((a, b) => b.score - a.score);

  const out: Array<Record<string, unknown>> = [];
  for (const row of ranked.slice(0, limit)) {
    const c = row.campaign;
    const raw = byId.get(String(c.contentId));
    if (!raw) continue;
    const ctaDoc = c.cta as { label?: string; url?: string } | undefined;
    const ctaLabel = typeof ctaDoc?.label === "string" ? ctaDoc.label.trim() : "";
    const ctaUrl = typeof ctaDoc?.url === "string" ? ctaDoc.url.trim() : "";
    const promotionCta = ctaLabel && ctaUrl ? { label: ctaLabel, url: ctaUrl } : undefined;

    out.push({
      ...raw,
      isPromoted: true,
      promotionId: String(c._id),
      promotionObjective: c.objective,
      promotionCta,
    });
  }
  return out;
}

function splicePromotedIntoFeed(
  organicMapped: Record<string, unknown>[],
  promotedRaw: Array<Record<string, unknown>>,
  likedSet: Set<string>,
  followingSet: Set<string>,
  dbUserId: string | undefined,
): Record<string, unknown>[] {
  const seen = new Set(organicMapped.map((p) => String(p._id)));
  const promoted = promotedRaw
    .filter((p) => !seen.has(String(p._id)))
    .map((p) => normalizePost(p as Record<string, unknown>, likedSet, followingSet, dbUserId));
  if (!promoted.length) return organicMapped;
  const allPosts = [...organicMapped];
  if (promoted[0]) allPosts.splice(Math.min(3, allPosts.length), 0, promoted[0]);
  if (promoted[1]) allPosts.splice(Math.min(9, allPosts.length), 0, promoted[1]);
  const deduped: Record<string, unknown>[] = [];
  const ids = new Set<string>();
  for (const row of allPosts) {
    const id = String((row as { _id?: unknown })._id ?? "");
    if (!id || ids.has(id)) continue;
    ids.add(id);
    deduped.push(row);
  }
  return deduped;
}

/** Story tray rings from active promotions (non-followed advertisers only). */
async function getPromotedStoryTrayGroups(
  viewerId: mongoose.Types.ObjectId,
  followingIds: mongoose.Types.ObjectId[],
  seenSet: Set<string>,
): Promise<Array<{ author: unknown; stories: unknown[]; isPromoted: boolean; promotionId: string }>> {
  const now = new Date();
  const capSince = new Date(Date.now() - DELIVERY_FREQ_CAP_WINDOW_MS);
  const campaigns = await PromotionCampaign.find({
    ...activePromotionClause(now),
    contentType: "story",
    ...campaignPlacementOr(["stories", "feed", "explore"]),
    ownerUserId: { $nin: [viewerId, ...followingIds] },
  })
    .sort({ createdAt: -1 })
    .limit(12)
    .lean();

  const [recentImpressions, interestScores] = await Promise.all([
    ContentDeliveryLog.find({
      viewerId,
      deliveryKind: "impression",
      createdAt: { $gte: capSince },
      promotionId: { $exists: true },
    })
      .select("promotionId")
      .lean(),
    getViewerInterestScores(viewerId),
  ]);
  const blockedPromotionIds = new Set(
    recentImpressions.map((x) => String((x as { promotionId?: unknown }).promotionId ?? "")),
  );

  const out: Array<{ author: unknown; stories: unknown[]; isPromoted: boolean; promotionId: string }> = [];
  const eligibleCampaigns = campaigns.filter((c) => !blockedPromotionIds.has(String(c._id)));
  const storyIds = eligibleCampaigns.map((c) => c.contentId).filter(Boolean);
  const storyDocs = storyIds.length
    ? await Post.find({
        _id: { $in: storyIds },
        type: "story",
        ...VISIBLE_POST,
        expiresAt: { $gt: now },
      })
        .populate("authorId", AUTHOR_SELECT)
        .lean()
    : [];
  const storyById = new Map(storyDocs.map((d) => [String(d._id), d]));
  for (const c of eligibleCampaigns) {
    const s = storyById.get(String(c.contentId));
    if (!s) continue;
    const storyCategory = normalizeCategory((s as { feedCategory?: unknown }).feedCategory);
    if (interestScores.size > 0 && (interestScores.get(storyCategory) ?? 0) <= 0) continue;
    const ctaDoc = c.cta as { label?: string; url?: string } | undefined;
    const ctaLabel = typeof ctaDoc?.label === "string" ? ctaDoc.label.trim() : "";
    const ctaUrl = typeof ctaDoc?.url === "string" ? ctaDoc.url.trim() : "";
    const promotionCta = ctaLabel && ctaUrl ? { label: ctaLabel, url: ctaUrl } : undefined;

    out.push({
      isPromoted: true,
      promotionId: String(c._id),
      author: s.authorId,
      stories: [
        {
          ...s,
          isPromoted: true,
          promotionId: String(c._id),
          promotionObjective: c.objective,
          promotionCta,
          seenByMe: seenSet.has(String(s._id)),
          mediaUrl: typeof s.mediaUrl === "string" ? rewritePublicMediaUrl(s.mediaUrl) : s.mediaUrl,
          thumbnailUrl:
            typeof s.thumbnailUrl === "string" ? rewritePublicMediaUrl(s.thumbnailUrl) : s.thumbnailUrl,
          hlsMasterUrl:
            typeof (s as { hlsMasterUrl?: string }).hlsMasterUrl === "string" && (s as { hlsMasterUrl?: string }).hlsMasterUrl!.trim()
              ? rewritePublicMediaUrl((s as { hlsMasterUrl?: string }).hlsMasterUrl!)
              : undefined,
          authorId: undefined,
        },
      ],
    });
    if (out.length >= 6) break;
  }
  return out;
}

/** Home strip: rank by raw engagement (likes, comments, views, shares) — simple, no decay. */
function simpleReelEngagementScore(p: {
  likesCount?: unknown;
  commentsCount?: unknown;
  viewsCount?: unknown;
  sharesCount?: unknown;
  trendingScore?: unknown;
}): number {
  return (
    Number(p.likesCount) * 1 +
    Number(p.commentsCount) * 2 +
    Number(p.viewsCount) * 0.01 +
    Number(p.sharesCount) * 3
  );
}

/** Recompute trendingScore for a post (fire-and-forget — never throws). */
function recomputeTrending(postId: string): void {
  Post.findById(postId)
    .select("likesCount commentsCount viewsCount sharesCount avgWatchTimeMs createdAt")
    .lean()
    .then((p) => {
      if (!p) return;
      const ageHours = Math.max(1, (Date.now() - new Date(p.createdAt).getTime()) / 3_600_000);
      // Wilson score-like formula: weighted signals / time decay
      const score =
        (Number(p.likesCount) * 3 +
          Number(p.commentsCount) * 5 +
          Number(p.viewsCount) * 0.1 +
          Number(p.sharesCount) * 4 +
          Math.min(Number(p.avgWatchTimeMs) / 1000, 60) * 2) /
        Math.pow(ageHours + 2, 1.5);
      Post.updateOne({ _id: postId }, { $set: { trendingScore: score } }).catch(() => null);
    })
    .catch(() => null);
}

// Small page size is intentional: the client never shows more than 1-3 items at
// once, so shipping 20 in the first response wastes bandwidth on rows the user
// may never scroll to. Next page loads on demand at the end-reached threshold.
const PAGE_SIZE = 6;
const TRENDING_WINDOW_MS = 48 * 3600 * 1000;
const FEED_TOPIC_TABS = new Set(["politics", "sports", "shopping", "tech"]);
const FEED_TYPES = { type: { $in: ["post", "reel"] } } as const;
const GENERAL_CATEGORY_CLAUSE = {
  $or: [{ feedCategory: "general" }, { feedCategory: { $exists: false } }, { feedCategory: "" }],
} as const;

/** Discover / explore / trending: reels are public; wall posts default to friends-only (`feedCategory: followers`). */
const DISCOVER_PUBLIC_POST = {
  $or: [
    { type: "reel" as const },
    { type: "post" as const, feedCategory: { $ne: "followers" } },
  ],
};

/**
 * Author's own profile grid + saved list: show processing drafts (async uploads) so counts match the grid.
 * Still hide failed encodes and soft-deleted content.
 */
const PROFILE_OR_SAVED_POST = {
  isDeleted: { $ne: true },
  processingStatus: { $nin: ["failed"] },
} as const;

/** Paginate root comments; preview only a few replies per thread (see thread endpoint for more). */
const COMMENT_ROOT_PAGE = 15;
const COMMENT_THREAD_PREVIEW = 5;
const COMMENT_THREAD_PAGE = 15;
const COMMENT_LEGACY_THREAD_CAP = 500;

async function resolveThreadRootId(parentId: string): Promise<mongoose.Types.ObjectId> {
  let id = parentId;
  for (let i = 0; i < 50; i++) {
    const cur = await Comment.findById(id).select("parentId threadRootId").lean();
    if (!cur) return new mongoose.Types.ObjectId(parentId);
    if (cur.threadRootId) return cur.threadRootId as mongoose.Types.ObjectId;
    if (!cur.parentId) return cur._id as mongoose.Types.ObjectId;
    id = String(cur.parentId);
  }
  return new mongoose.Types.ObjectId(parentId);
}

async function legacyThreadDescendants(
  postId: mongoose.Types.ObjectId,
  rootId: mongoose.Types.ObjectId,
  cap: number,
): Promise<Array<Record<string, unknown>>> {
  const rows = await Comment.aggregate([
    { $match: { _id: rootId, postId, isActive: true } },
    {
      $graphLookup: {
        from: "comments",
        startWith: "$_id",
        connectFromField: "_id",
        connectToField: "parentId",
        as: "desc",
        maxDepth: 100,
        restrictSearchWithMatch: { postId, isActive: true },
      },
    },
    { $project: { desc: 1 } },
  ]);
  const desc = (rows[0]?.desc ?? []) as Array<Record<string, unknown>>;
  desc.sort((a, b) => {
    const ta = new Date(a.createdAt as Date).getTime();
    const tb = new Date(b.createdAt as Date).getTime();
    if (ta !== tb) return ta - tb;
    return String(a._id).localeCompare(String(b._id));
  });
  return desc.slice(0, cap);
}

async function attachReplyingTo(
  rows: Array<Record<string, unknown>>,
): Promise<Array<Record<string, unknown>>> {
  const parentIds = [
    ...new Set(rows.map((r) => (r.parentId ? String(r.parentId) : "")).filter(Boolean)),
  ].map((id) => new mongoose.Types.ObjectId(id));
  if (!parentIds.length) {
    return rows.map((r) => ({
      ...r,
      author: r.authorId,
      authorId: undefined,
    }));
  }
  const parents = await Comment.find({ _id: { $in: parentIds } })
    .populate("authorId", AUTHOR_SELECT)
    .lean();
  const pmap = new Map(
    parents.map((p) => {
      const a = p.authorId as {_id: mongoose.Types.ObjectId; username?: string} | null;
      return [
        String(p._id),
        {
          userId: a?._id ? String(a._id) : "",
          username: typeof a?.username === "string" ? a.username : "user",
        },
      ];
    }),
  );
  return rows.map((r) => {
    const pid = r.parentId ? String(r.parentId) : "";
    return {
      ...r,
      author: r.authorId,
      authorId: undefined,
      replyingTo: pid ? pmap.get(pid) : undefined,
    };
  });
}

async function populateLeanCommentAuthors(
  docs: Array<Record<string, unknown>>,
): Promise<Array<Record<string, unknown>>> {
  const ids = [
    ...new Set(
      docs
        .map((d) => (d.authorId ? String(d.authorId) : ""))
        .filter(Boolean),
    ),
  ].map((id) => new mongoose.Types.ObjectId(id));
  if (!ids.length) return docs;
  const users = await User.find({_id: {$in: ids}}).select(AUTHOR_SELECT).lean();
  const umap = new Map(users.map((u) => [String(u._id), u]));
  return docs.map((d) => ({
    ...d,
    authorId: umap.get(String(d.authorId)) ?? d.authorId,
  }));
}

/** ETag for story tray includes viewer’s seen set so 304 invalidates after mark-seen. */
function storiesTrayEtag(
  slim: Array<{ _id: mongoose.Types.ObjectId; updatedAt: Date }>,
  seenSortedIds: string,
): string {
  const payload = slim
    .map((s) => `${String(s._id)}:${new Date(s.updatedAt).getTime()}`)
    .sort()
    .join("|");
  const h = createHash("sha1").update(`${payload}||${seenSortedIds}`).digest("hex").slice(0, 28);
  return `"${h}"`;
}

function normalizeIfNoneMatch(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const t = v.trim();
  if (t.startsWith("W/")) return t.slice(2).trim();
  return t;
}

function normalizePost(p: Record<string, unknown>, likedSet: Set<string>, followingSet: Set<string>, dbUserId?: string) {
  const author = p.authorId as Record<string, unknown> | null;
  const authorOid = author ? String((author as {_id: unknown})._id) : "";
  const isSelf = Boolean(dbUserId && authorOid && authorOid === dbUserId);
  const isFollowing = Boolean(
    dbUserId && authorOid && (isSelf || followingSet.has(authorOid)),
  );
  const mediaUrl = typeof p.mediaUrl === "string" ? rewritePublicMediaUrl(p.mediaUrl) : p.mediaUrl;
  const thumbnailUrl =
    typeof p.thumbnailUrl === "string" ? rewritePublicMediaUrl(p.thumbnailUrl) : p.thumbnailUrl;
  const hlsMasterUrl =
    typeof p.hlsMasterUrl === "string" && p.hlsMasterUrl.trim()
      ? rewritePublicMediaUrl(p.hlsMasterUrl)
      : undefined;
  const rawFc = (p as { feedCategory?: unknown }).feedCategory;
  const feedCategory =
    typeof rawFc === "string" && rawFc.trim() ? rawFc.trim() : "general";
  return {
    ...p,
    mediaUrl,
    thumbnailUrl,
    hlsMasterUrl,
    feedCategory,
    likesCount: Number(p.likesCount) || 0,
    commentsCount: Number(p.commentsCount) || 0,
    viewsCount: Number(p.viewsCount) || 0,
    impressionsCount: Number(p.impressionsCount) || 0,
    sharesCount: Number(p.sharesCount) || 0,
    avgWatchTimeMs: Number(p.avgWatchTimeMs) || 0,
    trendingScore: Number(p.trendingScore) || 0,
    isLiked: likedSet.has(String(p._id)),
    author: author ? {
      ...author,
      followersCount: Number(author.followersCount) || 0,
    } : null,
    isFollowing,
    authorId: undefined,
  };
}

function sanitizePollInput(raw: unknown): { question: string; options: string[]; votes: number[] } | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as { question?: unknown; options?: unknown };
  const question = typeof obj.question === "string" ? obj.question.trim().slice(0, 140) : "";
  const optionsRaw = Array.isArray(obj.options) ? obj.options : [];
  const options = optionsRaw
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean)
    .slice(0, 4);
  if (options.length < 2) return undefined;
  return {
    question,
    options,
    votes: options.map(() => 0),
  };
}

// ── GET /posts/feed ─────────────────────────────────────────────────
postsRouter.get(
  "/feed",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const dbUser = req.dbUser;
      const tabRaw = String(req.query.tab ?? "for-you").toLowerCase();
      let tab = tabRaw === "home" ? "for-you" : tabRaw;
      if (tab !== "for-you" && tab !== "trending" && !FEED_TOPIC_TABS.has(tab)) {
        tab = "for-you";
      }

      const [follows, likes] = dbUser
        ? await Promise.all([
            Follow.find({ followerId: dbUser._id, status: "accepted" }).select("followingId").lean(),
            Like.find({ userId: dbUser._id, targetType: "post" }).select("targetId").lean(),
          ])
        : [[] as Array<{ followingId: mongoose.Types.ObjectId }>, [] as Array<{ targetId: mongoose.Types.ObjectId }>];
      const followingIds = follows.map((f) => f.followingId);
      const hasFollows = followingIds.length > 0;

      const likedSet = new Set(likes.map((l) => String(l.targetId)));
      const followingSet = new Set(followingIds.map(String));

      const mapPosts = (posts: Record<string, unknown>[]) =>
        posts.map((p) =>
          normalizePost(p, likedSet, followingSet, String(dbUser?._id)),
        );

      if (tab === "for-you") {
        const fyPhaseRaw = String(req.query.fyPhase ?? "friends").toLowerCase();
        const fyPhase = fyPhaseRaw === "general" ? "general" : "friends";
        const cf = req.query.cf as string | undefined;
        const cg = req.query.cg as string | undefined;

        // No follows: home still uses "friends" phase but only surfaces promoted content (no organic stranger posts).
        if (fyPhase === "friends" && dbUser && !hasFollows) {
          const promotedRaw = await getPromotedPostDocs(dbUser._id, [dbUser._id], ["feed", "explore"], 8);
          const onlyPromoted = promotedRaw.map((p) =>
            normalizePost(p as Record<string, unknown>, likedSet, followingSet, String(dbUser._id)),
          );
          return res.json({
            posts: onlyPromoted,
            tab: "for-you",
            forYouPhase: "friends",
            hasMoreFriends: false,
            hasMoreGeneral: false,
            nextCursorFriends: null,
            nextCursorGeneral: null,
            page: 1,
          });
        }

        const wantFriends = fyPhase === "friends" && hasFollows && dbUser;

        if (wantFriends) {
          // Serve from cache for the first page (no cursor) to skip DB round-trips on re-open
          const feedCacheKey = `${String(dbUser._id)}_friends`;
          if (!cf) {
            const cachedFeed =
              (await cacheGetJson<FeedPageResult>(`feed:p1:${feedCacheKey}`)) ?? feedPageCache.get(feedCacheKey);
            if (cachedFeed) {
              res.setHeader("Cache-Control", "private, max-age=30");
              res.setHeader("x-bromo-cache-source", "cache");
              return res.json({...cachedFeed, tab: "for-you", forYouPhase: "friends",
                hasMoreFriends: cachedFeed.hasMore, hasMoreGeneral: false,
                nextCursorFriends: null, nextCursorGeneral: null, page: 1});
            }
          }

          const baseQuery = {
            authorId: { $in: [...followingIds, dbUser._id] },
            ...FEED_TYPES,
            ...VISIBLE_POST,
          };
          const query =
            cf && mongoose.Types.ObjectId.isValid(cf)
              ? { ...baseQuery, _id: { $lt: new mongoose.Types.ObjectId(cf) } }
              : baseQuery;

          const posts = await Post.find(query)
            .sort({ _id: -1 })
            .limit(PAGE_SIZE)
            .populate("authorId", AUTHOR_SELECT)
            .lean();

          const hasMoreFriends = posts.length === PAGE_SIZE;
          const nextCursorFriends = hasMoreFriends ? String(posts[posts.length - 1]._id) : null;

          let friendPosts = mapPosts(posts as unknown as Record<string, unknown>[]);
          if (!cf && dbUser) {
            const excludeAuthors = [...followingIds, dbUser._id] as mongoose.Types.ObjectId[];
            const promotedRaw = await getPromotedPostDocs(dbUser._id, excludeAuthors, ["feed", "explore"], 2);
            friendPosts = splicePromotedIntoFeed(
              friendPosts,
              promotedRaw,
              likedSet,
              followingSet,
              String(dbUser._id),
            ) as typeof friendPosts;
          }

          if (!cf) {
            feedPageCache.set(feedCacheKey, {posts: friendPosts, hasMore: hasMoreFriends});
            await cacheSetJson(`feed:p1:${feedCacheKey}`, {posts: friendPosts, hasMore: hasMoreFriends}, 30);
          }

          res.setHeader("Cache-Control", "private, max-age=30");
          res.setHeader("x-bromo-cache-source", "db");
          return res.json({
            posts: friendPosts,
            tab: "for-you",
            forYouPhase: "friends",
            hasMoreFriends,
            hasMoreGeneral: false,
            nextCursorFriends,
            nextCursorGeneral: null,
            page: 1,
          });
        }

        const excludeAuthors =
          hasFollows && dbUser ? [...followingIds, dbUser._id] : dbUser ? [dbUser._id] : [];

        // For-you "general" is deprecated for the home firehose: no organic stranger wall posts here (use /posts/explore).
        // Only promoted injections reach non-followers on this tab.
        const posts: Array<Record<string, unknown>> = [];
        const hasMoreGeneral = false;
        const nextCursorGeneral = null;

        let allPosts = mapPosts(posts);
        if (dbUser) {
          const promotedRaw = await getPromotedPostDocs(
            dbUser._id,
            excludeAuthors as mongoose.Types.ObjectId[],
            ["feed", "explore"],
            6,
          );
          allPosts = splicePromotedIntoFeed(
            allPosts,
            promotedRaw,
            likedSet,
            followingSet,
            String(dbUser._id),
          ) as typeof allPosts;
        }

        return res.json({
          posts: allPosts,
          tab: "for-you",
          forYouPhase: "general",
          hasMoreFriends: false,
          hasMoreGeneral,
          nextCursorFriends: null,
          nextCursorGeneral,
          page: 1,
        });
      }

      if (tab === "trending") {
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const skip = (page - 1) * PAGE_SIZE;
        const since = new Date(Date.now() - TRENDING_WINDOW_MS);

        const posts = await Post.find({
          ...FEED_TYPES,
          ...VISIBLE_POST,
          ...DISCOVER_PUBLIC_POST,
          createdAt: { $gte: since },
        })
          .sort({ trendingScore: -1, _id: -1 })
          .skip(skip)
          .limit(PAGE_SIZE)
          .populate("authorId", AUTHOR_SELECT)
          .lean();

        return res.json({
          posts: mapPosts(posts as unknown as Record<string, unknown>[]),
          tab: "trending",
          page,
          hasMore: posts.length === PAGE_SIZE,
        });
      }

      if (FEED_TOPIC_TABS.has(tab)) {
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const skip = (page - 1) * PAGE_SIZE;

        const posts = await Post.find({
          ...FEED_TYPES,
          ...VISIBLE_POST,
          ...DISCOVER_PUBLIC_POST,
          feedCategory: tab,
        })
          .sort({ _id: -1 })
          .skip(skip)
          .limit(PAGE_SIZE)
          .populate("authorId", AUTHOR_SELECT)
          .lean();

        return res.json({
          posts: mapPosts(posts as unknown as Record<string, unknown>[]),
          tab,
          page,
          hasMore: posts.length === PAGE_SIZE,
        });
      }

      return res.status(500).json({ message: "Feed tab handler missing" });
    } catch (err) {
      console.error("[posts] feed error:", err);
      return res.status(500).json({ message: "Failed to fetch feed" });
    }
  },
);

postsRouter.get("/feed/initial", requireFirebaseToken, async (req: FirebaseAuthedRequest, res: Response) => {
  try {
    const dbUser = req.dbUser;
    if (!perfFlags.cursorApiV2 || !dbUser || !isCanaryUser(String(dbUser._id))) {
      return res.status(404).json({ message: "feed v2 disabled" });
    }
    const [follows, likes] = await Promise.all([
      Follow.find({ followerId: dbUser._id, status: "accepted" }).select("followingId").lean(),
      Like.find({ userId: dbUser._id, targetType: "post" }).select("targetId").lean(),
    ]);
    const followingIds = follows.map((f) => f.followingId);
    const hasFollows = followingIds.length > 0;
    const likedSet = new Set(likes.map((l) => String(l.targetId)));
    const followingSet = new Set(followingIds.map(String));

    const mapPosts = (rows: Record<string, unknown>[]) =>
      rows.map((p) => normalizePost(p, likedSet, followingSet, String(dbUser._id)));

    // Match GET /posts/feed for-you: no follows → promoted-only surface (not an empty authorId $in).
    if (!hasFollows) {
      const promotedRaw = await getPromotedPostDocs(dbUser._id, [dbUser._id], ["feed", "explore"], 8);
      const onlyPromoted = promotedRaw.map((p) =>
        normalizePost(p as Record<string, unknown>, likedSet, followingSet, String(dbUser._id)),
      );
      return res.json({ posts: onlyPromoted, tab: "for-you", cursor: null, hasMore: false });
    }

    const posts = await Post.find({
      authorId: { $in: [...followingIds, dbUser._id] },
      ...FEED_TYPES,
      ...VISIBLE_POST,
    })
      .sort({ _id: -1 })
      .limit(PAGE_SIZE)
      .populate("authorId", AUTHOR_SELECT)
      .lean();

    const hasMoreFriends = posts.length === PAGE_SIZE;
    const nextCursor = hasMoreFriends ? String(posts[posts.length - 1]._id) : null;

    let friendPosts = mapPosts(posts as unknown as Record<string, unknown>[]);
    const excludeAuthors = [...followingIds, dbUser._id] as mongoose.Types.ObjectId[];
    const promotedRaw = await getPromotedPostDocs(dbUser._id, excludeAuthors, ["feed", "explore"], 2);
    friendPosts = splicePromotedIntoFeed(
      friendPosts,
      promotedRaw,
      likedSet,
      followingSet,
      String(dbUser._id),
    ) as typeof friendPosts;

    return res.json({ posts: friendPosts, tab: "for-you", cursor: nextCursor, hasMore: hasMoreFriends });
  } catch (err) {
    console.error("[posts] feed/initial error:", err);
    return res.status(500).json({ message: "Failed to fetch feed initial page" });
  }
});

postsRouter.get("/feed/next", requireFirebaseToken, async (req: FirebaseAuthedRequest, res: Response) => {
  try {
    const dbUser = req.dbUser;
    if (!perfFlags.cursorApiV2 || !dbUser || !isCanaryUser(String(dbUser._id))) {
      return res.status(404).json({ message: "feed v2 disabled" });
    }
    const cursor = String(req.query.cursor ?? "").trim();
    if (!dbUser || !cursor || !mongoose.Types.ObjectId.isValid(cursor)) {
      return res.status(400).json({ message: "valid cursor is required" });
    }
    const [follows, likes] = await Promise.all([
      Follow.find({ followerId: dbUser._id, status: "accepted" }).select("followingId").lean(),
      Like.find({ userId: dbUser._id, targetType: "post" }).select("targetId").lean(),
    ]);
    const followingIds = follows.map((f) => f.followingId);
    const likedSet = new Set(likes.map((l) => String(l.targetId)));
    const followingSet = new Set(followingIds.map(String));
    const posts = await Post.find({
      authorId: { $in: [...followingIds, dbUser._id] },
      ...FEED_TYPES,
      ...VISIBLE_POST,
      _id: { $lt: new mongoose.Types.ObjectId(cursor) },
    })
      .sort({ _id: -1 })
      .limit(PAGE_SIZE)
      .populate("authorId", AUTHOR_SELECT)
      .lean();
    const nextCursor = posts.length === PAGE_SIZE ? String(posts[posts.length - 1]._id) : null;
    const out = posts.map((p) =>
      normalizePost(p as unknown as Record<string, unknown>, likedSet, followingSet, String(dbUser._id)),
    );
    return res.json({ posts: out, tab: "for-you", cursor: nextCursor, hasMore: posts.length === PAGE_SIZE });
  } catch (err) {
    console.error("[posts] feed/next error:", err);
    return res.status(500).json({ message: "Failed to fetch feed next page" });
  }
});

// ── GET /posts/reels ─────────────────────────────────────────────────
postsRouter.get(
  "/reels",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const dbUser = req.dbUser;
      const cursor = req.query.cursor as string | undefined;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const skip = cursor ? 0 : (page - 1) * PAGE_SIZE;

      // Page-1, no cursor: try cache before any DB work
      const cacheKey = dbUser ? `${String(dbUser._id)}_p1` : null;
      if (!cursor && page === 1 && cacheKey) {
        const cached =
          (await cacheGetJson<ReelPageResult>(`reel:p1:${cacheKey}`)) ?? reelPageCache.get(cacheKey);
        if (cached) {
          res.setHeader("Cache-Control", "private, max-age=30");
          res.setHeader("x-bromo-cache-source", "cache");
          return res.json({...cached, page});
        }
      }

      const hiddenIds: mongoose.Types.ObjectId[] = [];
      if (dbUser) {
        const hides = await mongoose.connection
          .collection("post_hides")
          .find({ userId: dbUser._id })
          .project({ postId: 1 })
          .toArray();
        for (const h of hides) {
          const pid = h.postId as mongoose.Types.ObjectId | undefined;
          if (pid) hiddenIds.push(pid);
        }
      }

      const baseQuery = { type: "reel" as const, ...VISIBLE_POST };
      const idClause = cursor
        ? {
            _id: {
              $lt: new mongoose.Types.ObjectId(cursor),
              ...(hiddenIds.length ? {$nin: hiddenIds} : {}),
            },
          }
        : hiddenIds.length
          ? {_id: {$nin: hiddenIds}}
          : {};
      const query = {...baseQuery, ...idClause};

      // Fetch posts + likes + follows all in parallel — was 3 sequential round-trips
      const [posts, likes, follows] = await Promise.all([
        Post.find(query)
          .sort({ _id: -1 })
          .skip(skip)
          .limit(PAGE_SIZE)
          .populate("authorId", AUTHOR_SELECT)
          .lean(),
        dbUser
          ? Like.find({ userId: dbUser._id, targetType: "post" }).select("targetId").lean()
          : Promise.resolve([]),
        dbUser
          ? Follow.find({ followerId: dbUser._id, status: "accepted" }).select("followingId").lean()
          : Promise.resolve([]),
      ]);

      const likedSet = new Set(likes.map((l) => String(l.targetId)));
      const followingIds = follows.map((f) => f.followingId);
      const followingSet = new Set(followingIds.map(String));

      let result = posts.map((p) =>
        normalizePost(p as unknown as Record<string, unknown>, likedSet, followingSet, String(dbUser?._id)),
      );

      if (!cursor && page === 1 && dbUser) {
        const promotedRaw = await getPromotedPostDocs(
          dbUser._id,
          [...followingIds, dbUser._id] as mongoose.Types.ObjectId[],
          ["reels", "feed", "explore"],
          1,
          "reel",
        );
        if (promotedRaw.length) {
          const rawPr = promotedRaw[0] as Record<string, unknown>;
          const prId = String(rawPr._id);
          const p0 = normalizePost(rawPr, likedSet, followingSet, String(dbUser._id));
          const seen = new Set(result.map((x) => String((x as unknown as {_id: unknown})._id)));
          if (!seen.has(prId)) {
            result = [p0, ...result];
          }
        }
      }

      const nextCursor = posts.length === PAGE_SIZE ? String(posts[posts.length - 1]._id) : null;
      const pageResult: ReelPageResult = {posts: result, hasMore: posts.length === PAGE_SIZE, nextCursor};

      if (!cursor && page === 1 && cacheKey) {
        reelPageCache.set(cacheKey, pageResult);
        await cacheSetJson(`reel:p1:${cacheKey}`, pageResult, 30);
      }

      res.setHeader("Cache-Control", "private, max-age=30");
      res.setHeader("x-bromo-cache-source", "db");
      return res.json({...pageResult, page});
    } catch (err) {
      console.error("[posts] reels error:", err);
      return res.status(500).json({ message: "Failed to fetch reels" });
    }
  },
);

// Cursor-first v2 contracts — parity with GET /posts/reels (hides, likes, follows, promoted reel).
postsRouter.get("/reels/initial", requireFirebaseToken, async (req: FirebaseAuthedRequest, res: Response) => {
  try {
    const dbUser = req.dbUser;
    if (!perfFlags.cursorApiV2 || !dbUser || !isCanaryUser(String(dbUser._id))) {
      return res.status(404).json({ message: "reels v2 disabled" });
    }

    const hiddenIds: mongoose.Types.ObjectId[] = [];
    const hides = await mongoose.connection
      .collection("post_hides")
      .find({ userId: dbUser._id })
      .project({ postId: 1 })
      .toArray();
    for (const h of hides) {
      const pid = h.postId as mongoose.Types.ObjectId | undefined;
      if (pid) hiddenIds.push(pid);
    }

    const baseQuery = { type: "reel" as const, ...VISIBLE_POST };
    const idClause = hiddenIds.length ? {_id: {$nin: hiddenIds}} : {};
    const query = {...baseQuery, ...idClause};

    const [posts, likes, follows] = await Promise.all([
      Post.find(query)
        .sort({ _id: -1 })
        .limit(PAGE_SIZE)
        .populate("authorId", AUTHOR_SELECT)
        .lean(),
      Like.find({ userId: dbUser._id, targetType: "post" }).select("targetId").lean(),
      Follow.find({ followerId: dbUser._id, status: "accepted" }).select("followingId").lean(),
    ]);

    const likedSet = new Set(likes.map((l) => String(l.targetId)));
    const followingIds = follows.map((f) => f.followingId);
    const followingSet = new Set(followingIds.map(String));

    let result = posts.map((p) =>
      normalizePost(p as unknown as Record<string, unknown>, likedSet, followingSet, String(dbUser._id)),
    );

    const promotedRaw = await getPromotedPostDocs(
      dbUser._id,
      [...followingIds, dbUser._id] as mongoose.Types.ObjectId[],
      ["reels", "feed", "explore"],
      1,
      "reel",
    );
    if (promotedRaw.length) {
      const rawPr = promotedRaw[0] as Record<string, unknown>;
      const prId = String(rawPr._id);
      const p0 = normalizePost(rawPr, likedSet, followingSet, String(dbUser._id));
      const seen = new Set(result.map((x) => String((x as unknown as {_id: unknown})._id)));
      if (!seen.has(prId)) {
        result = [p0, ...result];
      }
    }

    const nextCursor = posts.length === PAGE_SIZE ? String(posts[posts.length - 1]._id) : null;
    return res.json({posts: result, hasMore: posts.length === PAGE_SIZE, nextCursor});
  } catch (err) {
    console.error("[posts] reels/initial error:", err);
    return res.status(500).json({ message: "Failed to fetch reels initial page" });
  }
});

postsRouter.get("/reels/next", requireFirebaseToken, async (req: FirebaseAuthedRequest, res: Response) => {
  try {
    const dbUser = req.dbUser;
    if (!perfFlags.cursorApiV2 || !dbUser || !isCanaryUser(String(dbUser._id))) {
      return res.status(404).json({ message: "reels v2 disabled" });
    }
    const cursor = String(req.query.cursor ?? "").trim();
    if (!cursor || !mongoose.Types.ObjectId.isValid(cursor)) {
      return res.status(400).json({ message: "cursor is required" });
    }

    const hiddenIds: mongoose.Types.ObjectId[] = [];
    const hides = await mongoose.connection
      .collection("post_hides")
      .find({ userId: dbUser._id })
      .project({ postId: 1 })
      .toArray();
    for (const h of hides) {
      const pid = h.postId as mongoose.Types.ObjectId | undefined;
      if (pid) hiddenIds.push(pid);
    }

    const [posts, likes, follows] = await Promise.all([
      Post.find({
        type: "reel",
        ...VISIBLE_POST,
        _id: {
          $lt: new mongoose.Types.ObjectId(cursor),
          ...(hiddenIds.length ? {$nin: hiddenIds} : {}),
        },
      })
        .sort({ _id: -1 })
        .limit(PAGE_SIZE)
        .populate("authorId", AUTHOR_SELECT)
        .lean(),
      Like.find({ userId: dbUser._id, targetType: "post" }).select("targetId").lean(),
      Follow.find({ followerId: dbUser._id, status: "accepted" }).select("followingId").lean(),
    ]);

    const likedSet = new Set(likes.map((l) => String(l.targetId)));
    const followingIds = follows.map((f) => f.followingId);
    const followingSet = new Set(followingIds.map(String));

    const out = posts.map((p) =>
      normalizePost(p as unknown as Record<string, unknown>, likedSet, followingSet, String(dbUser._id)),
    );
    const nextCursor = posts.length === PAGE_SIZE ? String(posts[posts.length - 1]._id) : null;
    return res.json({posts: out, hasMore: posts.length === PAGE_SIZE, nextCursor});
  } catch (err) {
    console.error("[posts] reels/next error:", err);
    return res.status(500).json({ message: "Failed to fetch reels next page" });
  }
});

// ── GET /posts/saved ────────────────────────────────────────────────
postsRouter.get(
  "/saved",
  requireVerifiedUser,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const user = req.dbUser!;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const skip = (page - 1) * PAGE_SIZE;

      const saves = await mongoose.connection
        .collection("saved_posts")
        .find({
          $or: [{ userId: user._id }, { userId: String(user._id) }],
        })
        .sort({createdAt: -1})
        .skip(skip)
        .limit(PAGE_SIZE)
        .toArray();

      const ids = saves.map((s) => s.postId as mongoose.Types.ObjectId).filter(Boolean);
      if (ids.length === 0) {
        res.setHeader("Cache-Control", "private, no-store");
        return res.json({posts: [], page, hasMore: false});
      }

      const postsRaw = await Post.find({
        _id: {$in: ids},
        ...PROFILE_OR_SAVED_POST,
      })
        .populate("authorId", AUTHOR_SELECT)
        .lean();

      const follows = await Follow.find({followerId: user._id, status: "accepted"}).select("followingId").lean();
      const followingSet = new Set(follows.map((f) => String(f.followingId)));
      const likes = await Like.find({userId: user._id, targetType: "post", targetId: {$in: ids}})
        .select("targetId")
        .lean();
      const likedSet = new Set(likes.map((l) => String(l.targetId)));

      const order = new Map(ids.map((id, i) => [String(id), i]));
      postsRaw.sort((a, b) => (order.get(String(a._id)) ?? 0) - (order.get(String(b._id)) ?? 0));

      const result = postsRaw.map((p) =>
        normalizePost(p as unknown as Record<string, unknown>, likedSet, followingSet, String(user._id)),
      );

      res.setHeader("Cache-Control", "private, no-store");
      return res.json({posts: result, page, hasMore: saves.length === PAGE_SIZE});
    } catch (err) {
      console.error("[posts] saved error:", err);
      return res.status(500).json({message: "Failed to fetch saved posts"});
    }
  },
);

// ── GET /posts/explore ──────────────────────────────────────────────
postsRouter.get(
  "/explore",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const dbUser = req.dbUser;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const skip = (page - 1) * PAGE_SIZE;

      // Single Follow query shared for both exclude-ids and followingSet
      const follows = dbUser
        ? await Follow.find({followerId: dbUser._id, status: "accepted"}).select("followingId").lean()
        : [];
      const followingIds = follows.map((f) => f.followingId);
      const excludeIds = dbUser ? [...followingIds, dbUser._id] : [];

      const query = excludeIds.length
        ? {
            type: { $in: ["post", "reel"] },
            ...VISIBLE_POST,
            ...DISCOVER_PUBLIC_POST,
            authorId: { $nin: excludeIds },
          }
        : { type: { $in: ["post", "reel"] }, ...VISIBLE_POST, ...DISCOVER_PUBLIC_POST };

      const posts = await Post.find(query)
        .sort({ viewsCount: -1, createdAt: -1 })
        .skip(skip)
        .limit(PAGE_SIZE)
        .populate("authorId", AUTHOR_SELECT)
        .lean();

      const likes = dbUser
        ? await Like.find({
            userId: dbUser._id,
            targetType: "post",
            targetId: { $in: posts.map((p) => p._id) },
          })
            .select("targetId")
            .lean()
        : [];

      const followingSet = new Set(followingIds.map(String));
      const likedSet = new Set(likes.map((l) => String(l.targetId)));
      let result = posts.map((p) =>
        normalizePost(p as unknown as Record<string, unknown>, likedSet, followingSet, String(dbUser?._id)),
      );

      if (page === 1 && dbUser) {
        const promotedRaw = await getPromotedPostDocs(
          dbUser._id,
          [...followingIds, dbUser._id] as mongoose.Types.ObjectId[],
          ["explore", "feed"],
          2,
        );
        result = splicePromotedIntoFeed(
          result,
          promotedRaw,
          likedSet,
          followingSet,
          String(dbUser._id),
        ) as typeof result;
      }


      res.setHeader("Cache-Control", "private, no-store");
      return res.json({ posts: result, page, hasMore: posts.length === PAGE_SIZE });
    } catch (err) {
      console.error("[posts] explore error:", err);
      return res.status(500).json({ message: "Failed to fetch explore" });
    }
  },
);

// ── GET /posts/trending-reels ───────────────────────────────────────
postsRouter.get(
  "/trending-reels",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const dbUser = req.dbUser;
      const limit = Math.min(20, Math.max(1, parseInt(req.query.limit as string) || 3));
      const since = new Date(Date.now() - TRENDING_WINDOW_MS);
      /** Pull a pool by decaying score, then re-rank by simple engagement for the final strip. */
      const candidateCap = Math.min(120, Math.max(limit * 30, 60));

      const follows = dbUser
        ? await Follow.find({ followerId: dbUser._id, status: "accepted" }).select("followingId").lean()
        : [];
      const followingIds = follows.map((f) => f.followingId);
      const followingSet = new Set(followingIds.map(String));

      const candidates = await Post.find({
        type: "reel" as const,
        ...VISIBLE_POST,
        createdAt: { $gte: since },
      })
        .sort({ trendingScore: -1, _id: -1 })
        .limit(candidateCap)
        .populate("authorId", AUTHOR_SELECT)
        .lean();

      const ranked = [...candidates].sort((a, b) => {
        const s = simpleReelEngagementScore(b) - simpleReelEngagementScore(a);
        if (s !== 0) return s;
        return Number(b.trendingScore) - Number(a.trendingScore);
      });
      const posts = ranked.slice(0, limit);

      const likeRows = dbUser
        ? await Like.find({
            userId: dbUser._id,
            targetType: "post",
            targetId: { $in: posts.map((p) => p._id) },
          })
            .select("targetId")
            .lean()
        : [];
      const likedSet = new Set(likeRows.map((l) => String(l.targetId)));

      let result = posts.map((p) =>
        normalizePost(p as unknown as Record<string, unknown>, likedSet, followingSet, String(dbUser?._id)),
      );

      if (dbUser) {
        const promotedRaw = await getPromotedPostDocs(
          dbUser._id,
          [...followingIds, dbUser._id] as mongoose.Types.ObjectId[],
          ["reels", "feed", "explore"],
          1,
          "reel",
        );
        if (promotedRaw.length) {
          const rawPr = promotedRaw[0] as Record<string, unknown>;
          const prId = String(rawPr._id);
          const p0 = normalizePost(rawPr, likedSet, followingSet, String(dbUser._id));
          const seen = new Set(result.map((x) => String((x as unknown as {_id: unknown})._id)));
          if (!seen.has(prId)) {
            result = [p0, ...result].slice(0, limit);
          }
        }
      }

      res.setHeader("Cache-Control", "private, no-store");
      return res.json({ posts: result });
    } catch (err) {
      console.error("[posts] trending-reels error:", err);
      return res.status(500).json({ message: "Failed to fetch trending reels" });
    }
  },
);

// ── GET /posts/stories ──────────────────────────────────────────────
postsRouter.get(
  "/stories",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const dbUser = req.dbUser;
      if (!dbUser) {
        res.set("Cache-Control", "private, no-store");
        return res.json({ stories: [] });
      }

      const follows = await Follow.find({
        followerId: dbUser._id,
        status: "accepted",
      }).select("followingId").lean();
      const followingIds = follows.map((f) => f.followingId);
      const authorIds = [dbUser._id, ...followingIds];

      // Heal legacy story docs missing expiresAt — fire-and-forget.
      Post.collection
        .updateMany(
          {
            type: "story",
            authorId: { $in: authorIds },
            isActive: true,
            isDeleted: { $ne: true },
            processingStatus: { $nin: ["pending", "processing", "failed"] },
            $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }],
          },
          [{ $set: { expiresAt: { $add: ["$createdAt", 86400000] } } }],
        )
        .catch(() => null);

      const match = {
        type: "story" as const,
        ...VISIBLE_POST,
        authorId: { $in: authorIds },
        expiresAt: { $gt: new Date() },
      };

      // Single query with full populate — derive ETag from these results (no second round-trip).
      // Parallelize with StorySeen lookup and promoted story fetch.
      const [stories, seenRows, promoEtagRows] = await Promise.all([
        Post.find(match)
          .sort({ createdAt: -1 })
          .populate("authorId", AUTHOR_SELECT)
          .lean(),
        StorySeen.find({ viewerId: dbUser._id })
          .select({ storyPostId: 1 })
          .lean(),
        PromotionCampaign.find({
          ...activePromotionClause(new Date()),
          contentType: "story",
          ...campaignPlacementOr(["stories", "feed", "explore"]),
        })
          .select({ _id: 1 })
          .limit(40)
          .lean(),
      ]);

      const seenSet = new Set(seenRows.map((r) => String(r.storyPostId)));

      // Compute ETag from the full result set.
      const slim = stories.map((s) => ({ _id: s._id as mongoose.Types.ObjectId, updatedAt: s.updatedAt as Date }));
      const seenSortedIds = [...seenSet].sort().join("|");
      const promoSig = promoEtagRows.map((r) => String(r._id)).sort().join(",");
      const etag = storiesTrayEtag(slim, `${seenSortedIds}|${promoSig}`);
      const inm = normalizeIfNoneMatch(req.get("if-none-match"));
      if (inm && inm === etag) {
        res.setHeader("ETag", etag);
        res.set("Cache-Control", "private, max-age=120, stale-while-revalidate=300");
        return res.status(304).end();
      }

      // Promoted stories run in parallel with the grouping logic above.
      const promotedStoryGroupsP = getPromotedStoryTrayGroups(dbUser._id, followingIds, seenSet);

      const grouped: Record<string, { author: unknown; stories: unknown[] }> = {};
      for (const s of stories) {
        const authorId = String((s.authorId as { _id: mongoose.Types.ObjectId })._id);
        if (!grouped[authorId]) {
          grouped[authorId] = { author: s.authorId, stories: [] };
        }
        grouped[authorId].stories.push({
          ...s,
          seenByMe: seenSet.has(String(s._id)),
          mediaUrl: typeof s.mediaUrl === "string" ? rewritePublicMediaUrl(s.mediaUrl) : s.mediaUrl,
          thumbnailUrl:
            typeof s.thumbnailUrl === "string" ? rewritePublicMediaUrl(s.thumbnailUrl) : s.thumbnailUrl,
          hlsMasterUrl:
            typeof (s as { hlsMasterUrl?: string }).hlsMasterUrl === "string" && (s as { hlsMasterUrl?: string }).hlsMasterUrl!.trim()
              ? rewritePublicMediaUrl((s as { hlsMasterUrl?: string }).hlsMasterUrl!)
              : undefined,
          authorId: undefined,
        });
      }

      type GStory = { seenByMe?: boolean; createdAt: Date };
      type G = { author: unknown; stories: GStory[] };
      const groupsArr = Object.values(grouped) as G[];
      groupsArr.sort((a, b) => {
        const ua = a.stories.some((x) => !x.seenByMe);
        const ub = b.stories.some((x) => !x.seenByMe);
        if (ua !== ub) return ua ? -1 : 1;
        const maxA = Math.max(...a.stories.map((x) => new Date(x.createdAt).getTime()));
        const maxB = Math.max(...b.stories.map((x) => new Date(x.createdAt).getTime()));
        return maxB - maxA;
      });

      const promotedStoryGroups = await promotedStoryGroupsP;
      const mergedStories = [...promotedStoryGroups, ...groupsArr];

      res.setHeader("ETag", etag);
      res.set("Cache-Control", "private, max-age=120, stale-while-revalidate=300");
      return res.json({ stories: mergedStories });
    } catch (err) {
      console.error("[posts] stories error:", err);
      return res.status(500).json({ message: "Failed to fetch stories" });
    }
  },
);

// ── POST /posts/stories/:storyPostId/seen ───────────────────────────
postsRouter.post(
  "/stories/:storyPostId/seen",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const dbUser = req.dbUser;
      if (!dbUser) return res.status(401).json({ message: "Unauthorized" });
      const storyPostId = req.params.storyPostId;
      const story = await Post.findOne({
        _id: storyPostId,
        type: "story",
        ...VISIBLE_POST,
        expiresAt: { $gt: new Date() },
      })
        .select("authorId")
        .lean();
      if (!story) return res.status(404).json({ message: "Story not found" });

      const authorId = String(story.authorId);
      const isSelf = String(dbUser._id) === authorId;
      if (!isSelf) {
        const okFollow = await Follow.countDocuments({
          followerId: dbUser._id,
          followingId: story.authorId,
          status: "accepted",
        });
        if (okFollow === 0) {
          return res.status(403).json({ message: "Not allowed" });
        }
      }

      await StorySeen.updateOne(
        { viewerId: dbUser._id, storyPostId },
        { $set: { viewerId: dbUser._id, storyPostId } },
        { upsert: true },
      );

      return res.json({ ok: true });
    } catch (err) {
      console.error("[posts] story seen error:", err);
      return res.status(500).json({ message: "Failed to mark story seen" });
    }
  },
);

// ── POST /posts/story-from-reel ─────────────────────────────────────
postsRouter.post(
  "/story-from-reel",
  requireVerifiedUser,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const user = req.dbUser!;
      const { sourcePostId } = req.body as { sourcePostId?: string };
      if (!sourcePostId) return res.status(400).json({ message: "sourcePostId is required" });

      const src = await Post.findOne({
        _id: sourcePostId,
        type: { $in: ["reel", "post"] },
        ...VISIBLE_POST,
      }).lean();
      if (!src) return res.status(404).json({ message: "Post not found" });
      if (src.mediaType !== "video") {
        return res.status(400).json({ message: "Only video posts can be added to your story" });
      }

      const srcMediaUrl =
        typeof src.mediaUrl === "string" ? rewritePublicMediaUrl(src.mediaUrl) : String(src.mediaUrl ?? "");
      const srcRel = uploadRelativePathFromUrl(srcMediaUrl);
      if (!srcRel) {
        return res.status(400).json({
          message: "Source video must be stored on this server (relative /uploads/ path required).",
        });
      }

      const uploadsDir = uploadsRoot();
      const srcAbs = path.join(uploadsDir, ...srcRel.split("/"));
      if (!fs.existsSync(srcAbs)) {
        return res.status(404).json({ message: "Source media file not found on server" });
      }

      const ext = path.extname(srcAbs) || ".mp4";
      const destRel = `stories/${user._id}/${randomBytes(8).toString("hex")}${ext}`;
      const destAbs = path.join(uploadsDir, ...destRel.split("/"));
      fs.mkdirSync(path.dirname(destAbs), { recursive: true });
      fs.copyFileSync(srcAbs, destAbs);

      let thumbnailUrl =
        typeof src.thumbnailUrl === "string" && src.thumbnailUrl.trim()
          ? rewritePublicMediaUrl(src.thumbnailUrl)
          : "";
      if (!thumbnailUrl) {
        try {
          const thumbRel = await generateVideoThumbnail(destRel);
          thumbnailUrl = publicUrlForUploadRelative(thumbRel);
        } catch {
          thumbnailUrl = "";
        }
      }

      const draftPost = await Post.create({
        authorId: user._id,
        type: "story",
        mediaUrl: publicUrlForUploadRelative(destRel),
        thumbnailUrl,
        mediaType: "video",
        caption: "",
        location: "",
        music: typeof src.music === "string" ? src.music : "",
        tags: [],
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        isDeleted: false,
        processingStatus: "pending",
        isActive: false,
      });

      const job = await MediaJob.create({
        userId: user._id,
        rawRelPath: destRel,
        category: "stories",
        mediaType: "video",
        postDraftId: draftPost._id,
        status: "queued",
      });
      await Post.updateOne({ _id: draftPost._id }, { mediaJobId: job._id });
      enqueueMediaJob(String(job._id));

      const populated = await Post.findById(draftPost._id).populate("authorId", AUTHOR_SELECT).lean();
      const result = {
        ...populated,
        author: populated?.authorId,
        authorId: undefined,
      };
      return res.status(201).json({ post: result, jobId: String(job._id) });
    } catch (err) {
      console.error("[posts] story-from-reel error:", err);
      return res.status(500).json({ message: "Failed to add reel to story" });
    }
  },
);

// ── GET /posts/user/:userId/grid-stats ───────────────────────────────
/** Counts + metrics matching profile grids (post / reel); syncs User.postsCount to postCount + reelCount. */
postsRouter.get(
  "/user/:userId/grid-stats",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const dbUser = req.dbUser;
      const userId = String(req.params.userId ?? "").trim();
      if (!userId) {
        return res.status(400).json({ message: "userId required" });
      }

      const targetUser = await User.findById(userId).lean();
      if (!targetUser) return res.status(404).json({ message: "User not found" });

      const isOwnProfile =
        (dbUser != null && String(dbUser._id) === String(userId)) ||
        Boolean(
          req.firebaseUser &&
            typeof targetUser.firebaseUid === "string" &&
            targetUser.firebaseUid === req.firebaseUser.uid,
        );

      const listVisibility = isOwnProfile ? PROFILE_OR_SAVED_POST : VISIBLE_POST;
      const authorIdFilter = mongoose.Types.ObjectId.isValid(userId)
        ? new mongoose.Types.ObjectId(userId)
        : userId;

      const base = { authorId: authorIdFilter, ...listVisibility };
      const matchAgg = {...base, type: {$in: ["post", "reel"] as const}};

      const [postCount, reelCount, agg] = await Promise.all([
        Post.countDocuments({...base, type: "post"}),
        Post.countDocuments({...base, type: "reel"}),
        Post.aggregate([
          {$match: matchAgg},
          {
            $group: {
              _id: null as null,
              totalViews: {$sum: {$ifNull: ["$viewsCount", 0]}},
              totalImpressions: {$sum: {$ifNull: ["$impressionsCount", 0]}},
            },
          },
        ]),
      ]);

      const totals = agg[0] as {totalViews?: number; totalImpressions?: number} | undefined;
      const gridTotal = postCount + reelCount;

      void User.updateOne({_id: authorIdFilter}, {$set: {postsCount: gridTotal}}).catch(() => null);

      return res.json({
        postCount,
        reelCount,
        gridTotal,
        totalViews: Number(totals?.totalViews) || 0,
        totalImpressions: Number(totals?.totalImpressions) || 0,
      });
    } catch (err) {
      console.error("[posts] grid-stats error:", err);
      return res.status(500).json({message: "Failed to fetch grid stats"});
    }
  },
);

// ── GET /posts/user/:userId ─────────────────────────────────────────
postsRouter.get(
  "/user/:userId",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const dbUser = req.dbUser;
      const userId = String(req.params.userId ?? "").trim();
      const type = (req.query.type as string) || "post";
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const skip = (page - 1) * PAGE_SIZE;

      if (!userId) {
        return res.status(400).json({ message: "userId required" });
      }

      const targetUser = await User.findById(userId).lean();
      if (!targetUser) return res.status(404).json({ message: "User not found" });

      /** Same Firebase account as profile owner even if req.dbUser failed to attach (edge cases). */
      const isOwnProfile =
        (dbUser != null && String(dbUser._id) === String(userId)) ||
        Boolean(
          req.firebaseUser &&
            typeof targetUser.firebaseUid === "string" &&
            targetUser.firebaseUid === req.firebaseUser.uid,
        );

      if (type === "saved") {
        if (!isOwnProfile) {
          return res.status(403).json({ message: "Saved posts are private" });
        }
        /** Same as profile owner even when req.dbUser did not attach (use Mongo user id from URL). */
        const saverId = dbUser != null ? dbUser._id : targetUser._id;

        const saves = await mongoose.connection
          .collection("saved_posts")
          .find({
            $or: [{ userId: saverId }, { userId: String(saverId) }],
          })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(PAGE_SIZE)
          .toArray();
        const ids = saves.map((s) => s.postId as mongoose.Types.ObjectId).filter(Boolean);
        if (ids.length === 0) {
          return res.json({ posts: [], page, hasMore: false });
        }
        const postsRaw = await Post.find({
          _id: { $in: ids },
          ...PROFILE_OR_SAVED_POST,
        })
          .populate("authorId", AUTHOR_SELECT)
          .lean();
        const follows =
          dbUser != null
            ? await Follow.find({ followerId: dbUser._id, status: "accepted" })
                .select("followingId")
                .lean()
            : [];
        const followingSet = new Set(follows.map((f) => String(f.followingId)));
        const likedSet = new Set<string>();
        if (dbUser) {
          const likes = await Like.find({
            userId: dbUser._id,
            targetType: "post",
            targetId: { $in: ids },
          })
            .select("targetId")
            .lean();
          likes.forEach((l) => likedSet.add(String(l.targetId)));
        }
        const order = new Map(ids.map((id, i) => [String(id), i]));
        postsRaw.sort((a, b) => (order.get(String(a._id)) ?? 0) - (order.get(String(b._id)) ?? 0));
        const viewerId = dbUser != null ? String(dbUser._id) : String(targetUser._id);
        const result = postsRaw.map((p) =>
          normalizePost(p as unknown as Record<string, unknown>, likedSet, followingSet, viewerId),
        );
        return res.json({ posts: result, page, hasMore: saves.length === PAGE_SIZE });
      }

      const listVisibility = isOwnProfile ? PROFILE_OR_SAVED_POST : VISIBLE_POST;

      const authorIdFilter = mongoose.Types.ObjectId.isValid(userId)
        ? new mongoose.Types.ObjectId(userId)
        : userId;

      const sortParam = String(req.query.sort ?? "latest").toLowerCase();
      const sortSpec: Record<string, 1 | -1> =
        sortParam === "oldest"
          ? { createdAt: 1 }
          : sortParam === "views"
            ? { viewsCount: -1, createdAt: -1 }
            : sortParam === "likes"
              ? { likesCount: -1, createdAt: -1 }
              : { createdAt: -1 };

      /** Posts grid = feed posts only; Reels tab sends type=reel; `all` merges posts + reels. */
      const typeFilter =
        type === "reel"
          ? { type: "reel" as const }
          : type === "all"
            ? { type: { $in: ["post", "reel"] as const } }
            : { type: "post" as const };

      const [posts, follows] = await Promise.all([
        Post.find({
          authorId: authorIdFilter,
          ...typeFilter,
          ...listVisibility,
        })
          .sort(sortSpec)
          .skip(skip)
          .limit(PAGE_SIZE)
          .populate("authorId", AUTHOR_SELECT)
          .lean(),
        dbUser != null
          ? Follow.find({ followerId: dbUser._id, status: "accepted" }).select("followingId").lean()
          : Promise.resolve([] as Array<{ followingId: mongoose.Types.ObjectId }>),
      ]);
      const followingSet = new Set(follows.map((f) => String(f.followingId)));

      const likedSet = new Set<string>();
      if (dbUser) {
        const likes = await Like.find({
          userId: dbUser._id,
          targetType: "post",
          targetId: { $in: posts.map((p) => p._id) },
        }).select("targetId");
        likes.forEach((l) => likedSet.add(String(l.targetId)));
      }

      const result = posts.map((p) =>
        normalizePost(p as unknown as Record<string, unknown>, likedSet, followingSet, String(dbUser?._id)),
      );
      return res.json({ posts: result, page, hasMore: posts.length === PAGE_SIZE });
    } catch (err) {
      console.error("[posts] user posts error:", err);
      return res.status(500).json({ message: "Failed to fetch user posts" });
    }
  },
);

// ── GET /posts/user/:userId/trash ───────────────────────────────────
postsRouter.get(
  "/user/:userId/trash",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const dbUser = req.dbUser;
      const userId = String(req.params.userId ?? "").trim();
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const skip = (page - 1) * PAGE_SIZE;
      if (!dbUser || String(dbUser._id) !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const authorIdFilter = mongoose.Types.ObjectId.isValid(userId)
        ? new mongoose.Types.ObjectId(userId)
        : userId;
      const rows = await Post.find({
        authorId: authorIdFilter,
        isDeleted: true,
      })
        .sort({ deletedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(PAGE_SIZE)
        .populate("authorId", AUTHOR_SELECT)
        .lean();
      const out = rows.map((p) =>
        normalizePost(
          p as unknown as Record<string, unknown>,
          new Set<string>(),
          new Set<string>(),
          String(dbUser._id),
        ),
      );
      return res.json({
        posts: out,
        page,
        hasMore: rows.length === PAGE_SIZE,
      });
    } catch (err) {
      console.error("[posts] trash list error:", err);
      return res.status(500).json({ message: "Failed to fetch trash" });
    }
  },
);

// ── GET /posts/:id/why ──────────────────────────────────────────────
postsRouter.get(
  "/:id/why",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const id = String(req.params.id);
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(404).json({ message: "Post not found" });
      }
      const post = await Post.findById(id).select("authorId feedCategory viewsCount type isActive isDeleted").lean();
      if (!post || !post.isActive || post.isDeleted) {
        return res.status(404).json({ message: "Post not found" });
      }
      const dbUser = req.dbUser;
      const author = await User.findById(post.authorId).select("username").lean();
      const uname = author?.username ? `@${author.username}` : "this creator";
      const lines: string[] = [];
      let following = false;
      if (dbUser) {
        const f = await Follow.findOne({
          followerId: dbUser._id,
          followingId: post.authorId,
          status: "accepted",
        }).select("_id");
        following = !!f;
      }
      if (following) {
        lines.push(`You're seeing this because you follow ${uname}.`);
      } else {
        lines.push("This reel is public in the community feed.");
        lines.push("Ranking uses engagement (likes, comments, watch time) and how fresh the post is.");
      }
      const fcRaw = (post as { feedCategory?: string }).feedCategory;
      const fc = typeof fcRaw === "string" && fcRaw.trim() ? fcRaw.trim() : "general";
      if (fc !== "general") {
        lines.push(`Topic bucket: ${fc}.`);
      }
      lines.push("Tap Interested or Not interested so we can tune what you see next.");
      const summary = lines.join(" ");
      return res.json({ summary, lines });
    } catch (err) {
      console.error("[posts] why error:", err);
      return res.status(500).json({ message: "Failed to explain recommendation" });
    }
  },
);

// ── GET /posts/:id ──────────────────────────────────────────────────
postsRouter.get(
  "/:id",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const id = String(req.params.id);
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(404).json({ message: "Post not found" });
      }
      const dbUser = req.dbUser;
      const post = await Post.findById(id)
        .populate("authorId", AUTHOR_SELECT)
        .lean();
      if (!post || !post.isActive || post.isDeleted) return res.status(404).json({ message: "Post not found" });

      let isLiked = false;
      if (dbUser) {
        const like = await Like.findOne({ targetId: post._id, userId: dbUser._id, targetType: "post" });
        isLiked = !!like;
      }

      return res.json({
        post: {
          ...post,
          likesCount: Number(post.likesCount) || 0,
          commentsCount: Number(post.commentsCount) || 0,
          viewsCount: Number(post.viewsCount) || 0,
          isLiked,
          author: post.authorId,
          authorId: undefined,
        },
      });
    } catch (err) {
      console.error("[posts] get post error:", err);
      return res.status(500).json({ message: "Failed to fetch post" });
    }
  },
);

// ── POST /posts ─────────────────────────────────────────────────────
postsRouter.post(
  "/",
  requireVerifiedUser,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const user = req.dbUser!;
      const {
        type,
        mediaUrl,
        thumbnailUrl,
        mediaType,
        caption,
        location,
        locationMeta,
        music,
        tags,
        taggedUserIds,
        productIds,
        settings,
        durationMs,
        storyMeta,
        poll: pollRaw,
        feedCategory: feedCategoryRaw,
        scheduledFor: scheduledForRaw,
        clientEditMeta: clientEditMetaRaw,
      } = req.body as {
        type: "post" | "reel" | "story";
        mediaUrl: string;
        thumbnailUrl?: string;
        mediaType: "image" | "video";
        caption?: string;
        location?: string;
        locationMeta?: { name: string; lat?: number; lng?: number; address?: string; placeId?: string };
        music?: string;
        tags?: string[];
        taggedUserIds?: string[];
        productIds?: string[];
        settings?: { commentsOff?: boolean; hideLikes?: boolean; allowRemix?: boolean; closeFriendsOnly?: boolean };
        durationMs?: number;
        storyMeta?: { bgColor?: string; overlays?: unknown[] };
        poll?: { question?: string; options?: string[] };
        feedCategory?: string;
        scheduledFor?: string;
        clientEditMeta?: string | Record<string, unknown>;
      };

      const scheduledFor =
        typeof scheduledForRaw === "string" && scheduledForRaw.trim()
          ? new Date(scheduledForRaw)
          : undefined;
      const isScheduled =
        scheduledFor instanceof Date &&
        !Number.isNaN(scheduledFor.getTime()) &&
        scheduledFor.getTime() > Date.now();

      let clientEditMeta: Record<string, unknown> | undefined;
      if (clientEditMetaRaw != null) {
        try {
          const parsed =
            typeof clientEditMetaRaw === "string" ? JSON.parse(clientEditMetaRaw) : clientEditMetaRaw;
          if (parsed && typeof parsed === "object") {
            clientEditMeta = parsed as Record<string, unknown>;
          }
        } catch {
          /* ignore */
        }
      }
      const pollFromMeta = sanitizePollInput(
        clientEditMeta && typeof clientEditMeta === "object"
          ? (clientEditMeta as { poll?: unknown }).poll
          : undefined,
      );
      const poll = sanitizePollInput(pollRaw) ?? pollFromMeta;

      // For color-background stories, mediaUrl may be the sentinel "color-bg"
      const isColorBgStory = type === "story" && storyMeta?.bgColor && (!mediaUrl || mediaUrl === "color-bg");
      if (!isColorBgStory && (!mediaUrl || !mediaType || !type)) {
        return res.status(400).json({ message: "mediaUrl, mediaType and type are required" });
      }
      if (!type) {
        return res.status(400).json({ message: "type is required" });
      }

      if (type === "reel" && mediaType !== "video") {
        return res.status(400).json({ message: "Reels must use video media (not HEIC/photos)." });
      }

      const expiresAt =
        type === "story" && !isScheduled
          ? new Date(Date.now() + 24 * 60 * 60 * 1000)
          : undefined;
      // Wall posts + stories default to friends-only in discover; reels stay discoverable (general unless set).
      const feedCategory =
        type === "story"
          ? "followers"
          : type === "reel"
            ? normalizeFeedCategory(feedCategoryRaw)
            : feedCategoryRaw != null && String(feedCategoryRaw).trim() !== ""
              ? normalizeFeedCategory(feedCategoryRaw)
              : "followers";

      const safeTaggedUserIds = (taggedUserIds ?? [])
        .filter((x) => typeof x === "string" && mongoose.Types.ObjectId.isValid(x))
        .slice(0, 20)
        .map((x) => new mongoose.Types.ObjectId(x));
      const safeProductIds = (productIds ?? [])
        .filter((x) => typeof x === "string" && mongoose.Types.ObjectId.isValid(x))
        .slice(0, 6)
        .map((x) => new mongoose.Types.ObjectId(x));

      const post = await Post.create({
        authorId: user._id,
        type,
        mediaUrl: mediaUrl ?? "color-bg",
        thumbnailUrl: thumbnailUrl ?? "",
        mediaType: mediaType ?? "image",
        caption: caption?.trim() ?? "",
        location: location?.trim() ?? "",
        ...(locationMeta && locationMeta.name ? { locationMeta } : {}),
        music: music?.trim() ?? "",
        tags: tags ?? [],
        ...(safeTaggedUserIds.length ? { taggedUserIds: safeTaggedUserIds } : {}),
        ...(safeProductIds.length ? { productIds: safeProductIds } : {}),
        ...(settings ? { settings } : {}),
        ...(typeof durationMs === "number" ? { durationMs } : {}),
        ...(clientEditMeta ? { clientEditMeta } : {}),
        expiresAt,
        isDeleted: false,
        ...(isScheduled ? { scheduledFor } : {}),
        ...(isScheduled ? { isActive: false } : {}),
        feedCategory,
        ...(type === "story" && storyMeta ? { storyMeta } : {}),
        ...(poll ? { poll } : {}),
      });

      if (!isScheduled && (type === "post" || type === "reel")) {
        await User.findByIdAndUpdate(user._id, { $inc: { postsCount: 1 } });
      }

      const populated = await Post.findById(post._id)
        .populate("authorId", AUTHOR_SELECT)
        .lean();

      const result = { ...populated, author: populated?.authorId, authorId: undefined };

      // Real-time: broadcast new post/reel/story
      if (type === "story") {
        emitStoryNew(String(user._id));
      } else {
        emitPostNew(result as object);
      }

      if (safeTaggedUserIds.length) {
        await Promise.allSettled(
          safeTaggedUserIds.map((taggedId) =>
            createNotification({
              recipientId: taggedId,
              actorId: user._id,
              type: "mention",
              postId: post._id,
              message: `${user.username} mentioned you in a ${type}.`,
            }),
          ),
        );
      }

      const followers = await Follow.find({
        followingId: user._id,
        status: "accepted",
      })
        .select("followerId")
        .lean();
      const followerIds = followers
        .map((f) => String(f.followerId))
        .filter((id) => id && id !== String(user._id));
      if (followerIds.length) {
        await Promise.allSettled(
          followerIds.map((rid) =>
            createNotification({
              recipientId: rid,
              actorId: user._id,
              type: "new_post",
              postId: post._id,
              message: `${user.username} posted a new ${type}.`,
            }),
          ),
        );
      }

      return res.status(201).json({ post: result });
    } catch (err) {
      console.error("[posts] create error:", err);
      return res.status(500).json({ message: "Failed to create post" });
    }
  },
);

postsRouter.post(
  "/:id/poll-vote",
  requireVerifiedUser,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const user = req.dbUser!;
      const postId = String(req.params.id ?? "");
      const optionIndex = Number((req.body as { optionIndex?: unknown }).optionIndex);
      if (!mongoose.Types.ObjectId.isValid(postId)) {
        return res.status(400).json({ message: "Invalid post id" });
      }
      if (!Number.isInteger(optionIndex) || optionIndex < 0) {
        return res.status(400).json({ message: "Valid optionIndex required" });
      }
      const post = await Post.findOne({ _id: postId, ...VISIBLE_POST });
      if (!post?.poll?.options?.length || post.poll.options.length < 2) {
        return res.status(400).json({ message: "Poll is not enabled on this post" });
      }
      if (optionIndex >= post.poll.options.length) {
        return res.status(400).json({ message: "Invalid optionIndex" });
      }

      const existing = await PostPollVote.findOne({
        postId: post._id,
        userId: user._id,
      })
        .select("optionIndex")
        .lean();
      if (existing) {
        return res.status(200).json({
          voted: false,
          alreadyVoted: true,
          optionIndex: Number(existing.optionIndex),
          poll: post.poll,
        });
      }

      await PostPollVote.create({
        postId: post._id,
        userId: user._id,
        optionIndex,
      });
      const votes = [...(post.poll.votes ?? post.poll.options.map(() => 0))];
      while (votes.length < post.poll.options.length) votes.push(0);
      votes[optionIndex] = (Number(votes[optionIndex]) || 0) + 1;
      post.poll.votes = votes;
      await post.save();
      return res.status(200).json({
        voted: true,
        alreadyVoted: false,
        optionIndex,
        poll: post.poll,
      });
    } catch (err) {
      console.error("[posts] poll vote error:", err);
      return res.status(500).json({ message: "Failed to submit poll vote" });
    }
  },
);

// ── DELETE /posts/:id ───────────────────────────────────────────────
postsRouter.delete(
  "/:id",
  requireVerifiedUser,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const user = req.dbUser!;
      const post = await Post.findById(req.params.id);
      if (!post) return res.status(404).json({ message: "Post not found" });
      if (String(post.authorId) !== String(user._id)) {
        return res.status(403).json({ message: "Not authorized" });
      }
      if (post.isDeleted) {
        return res.status(404).json({ message: "Post not found" });
      }
      post.isDeleted = true;
      post.deletedAt = new Date();
      post.isActive = false;
      await post.save();
      if (authorPostsCountWasBumped(post)) {
        await User.findByIdAndUpdate(user._id, { $inc: { postsCount: -1 } });
      }
      emitPostDelete(String(req.params.id));
      return res.json({ message: "Post deleted" });
    } catch (err) {
      console.error("[posts] delete error:", err);
      return res.status(500).json({ message: "Failed to delete post" });
    }
  },
);

// ── POST /posts/:id/restore ─────────────────────────────────────────
postsRouter.post(
  "/:id/restore",
  requireVerifiedUser,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const user = req.dbUser!;
      const post = await Post.findById(req.params.id);
      if (!post) return res.status(404).json({ message: "Post not found" });
      if (String(post.authorId) !== String(user._id)) {
        return res.status(403).json({ message: "Not authorized" });
      }
      if (!post.isDeleted) {
        return res.status(400).json({ message: "Post is not in trash" });
      }
      post.isDeleted = false;
      post.isActive = true;
      post.deletedAt = undefined;
      await post.save();
      if (authorPostsCountWasBumped(post)) {
        await User.findByIdAndUpdate(user._id, { $inc: { postsCount: 1 } });
      }
      return res.json({ message: "Post restored" });
    } catch (err) {
      console.error("[posts] restore error:", err);
      return res.status(500).json({ message: "Failed to restore post" });
    }
  },
);

// ── DELETE /posts/:id/permanent ─────────────────────────────────────
postsRouter.delete(
  "/:id/permanent",
  requireVerifiedUser,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const user = req.dbUser!;
      const post = await Post.findById(req.params.id);
      if (!post) return res.status(404).json({ message: "Post not found" });
      if (String(post.authorId) !== String(user._id)) {
        return res.status(403).json({ message: "Not authorized" });
      }
      if (!post.isDeleted) {
        return res.status(400).json({ message: "Move content to trash first" });
      }
      await Promise.all([
        Comment.updateMany({ postId: post._id }, { $set: { isActive: false } }),
        Like.deleteMany({ targetType: "post", targetId: post._id }),
      ]);
      await Post.deleteOne({ _id: post._id });
      return res.json({ message: "Post permanently deleted" });
    } catch (err) {
      console.error("[posts] permanent delete error:", err);
      return res.status(500).json({ message: "Failed to permanently delete post" });
    }
  },
);

// ── POST /posts/:id/like ────────────────────────────────────────────
postsRouter.post(
  "/:id/like",
  requireVerifiedUser,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const user = req.dbUser!;
      const postId = String(req.params.id);

      const [existing, targetPost] = await Promise.all([
        Like.findOne({ targetId: postId, userId: user._id, targetType: "post" }),
        Post.findById(postId).select("authorId isDeleted isActive"),
      ]);
      if (!targetPost?.isActive || targetPost.isDeleted) {
        if (!existing) return res.status(404).json({ message: "Post not found" });
      }

      if (existing) {
        await existing.deleteOne();
        let count = 0;
        if (targetPost?.isActive && !targetPost.isDeleted) {
          const updated = await Post.findByIdAndUpdate(postId, { $inc: { likesCount: -1 } }, { new: true });
          count = updated?.likesCount ?? 0;
        } else {
          const snap = await Post.findById(postId).select("likesCount").lean();
          count = Number(snap?.likesCount) || 0;
        }
        emitPostLike(postId, count, false, String(user._id));
        return res.json({ liked: false, likesCount: count });
      }

      if (!targetPost?.isActive || targetPost.isDeleted) {
        return res.status(404).json({ message: "Post not found" });
      }

      await Like.create({ targetId: postId, userId: user._id, targetType: "post" });
      const post = await Post.findByIdAndUpdate(postId, { $inc: { likesCount: 1 } }, { new: true });
      const count = post?.likesCount ?? 0;
      emitPostLike(postId, count, true, String(user._id));

      // Persist + broadcast notification to post author
      if (post && String(post.authorId) !== String(user._id)) {
        createNotification({
          recipientId: post.authorId,
          actorId: user._id,
          type: "like",
          postId,
          message: `${user.displayName} liked your post`,
        });
        emitNotification(
          String(post.authorId),
          "like",
          String(user._id),
          postId,
          `${user.displayName} liked your post`,
        );
      }
      // Like milestone check + trending recompute (fire-and-forget)
      checkLikeMilestone(String(post?.authorId ?? ""), count, postId);
      recomputeTrending(postId);

      return res.json({ liked: true, likesCount: count });
    } catch (err) {
      console.error("[posts] like error:", err);
      return res.status(500).json({ message: "Failed to toggle like" });
    }
  },
);

// ── POST /posts/:id/view ────────────────────────────────────────────
postsRouter.post(
  "/:id/view",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    const watchMs = Math.min(Math.max(0, Number((req.body as {watchMs?: unknown}).watchMs) || 0), 3_600_000);
    const postId = String(req.params.id);

    /** Impression (watchMs === 0) counts a view once; watch-time updates must not inflate viewsCount. */
    const inc =
      watchMs <= 0
        ? {viewsCount: 1, impressionsCount: 1, totalWatchTimeMs: 0}
        : {totalWatchTimeMs: watchMs};

    Post.findOneAndUpdate(
      {_id: postId, isActive: true, isDeleted: {$ne: true}},
      {$inc: inc},
      {new: true},
    )
      .then((p) => {
        if (p && p.viewsCount > 0) {
          const avg = p.totalWatchTimeMs / p.viewsCount;
          Post.updateOne({_id: postId}, {$set: {avgWatchTimeMs: avg}}).catch(() => null);
        }
        recomputeTrending(postId);
      })
      .catch(() => null);

    return res.json({ ok: true });
  },
);

// ── GET /posts/:id/comments/thread/:rootId (paginated flat thread) ─
postsRouter.get(
  "/:id/comments/thread/:rootId",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const postId = String(req.params.id);
      const rootId = String(req.params.rootId);
      if (!mongoose.Types.ObjectId.isValid(postId) || !mongoose.Types.ObjectId.isValid(rootId)) {
        return res.status(400).json({ message: "Invalid id" });
      }
      const postIdObj = new mongoose.Types.ObjectId(postId);
      const rootObj = new mongoose.Types.ObjectId(rootId);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || COMMENT_THREAD_PAGE));
      const after = typeof req.query.after === "string" && mongoose.Types.ObjectId.isValid(req.query.after)
        ? String(req.query.after)
        : undefined;

      const post = await Post.findById(postId).select("isDeleted isActive").lean();
      if (!post?.isActive || post.isDeleted) {
        return res.status(404).json({ message: "Post not found" });
      }

      const rootDoc = await Comment.findOne({
        _id: rootObj,
        postId,
        isActive: true,
        parentId: {$exists: false},
      })
        .select("_id threadRootId")
        .lean();
      if (!rootDoc) return res.status(404).json({ message: "Thread not found" });

      const tr = (rootDoc.threadRootId as mongoose.Types.ObjectId | undefined) ?? rootObj;
      const indexedFilter: Record<string, unknown> = {
        postId,
        isActive: true,
        threadRootId: tr,
        _id: {$ne: rootObj},
      };
      let totalIndexed = await Comment.countDocuments(indexedFilter);

      if (totalIndexed > 0) {
        const q: Record<string, unknown> = {...indexedFilter};
        if (after) {
          const afterDoc = await Comment.findById(after).select("createdAt _id").lean();
          if (afterDoc) {
            q.$or = [
              {createdAt: {$gt: afterDoc.createdAt}},
              {$and: [{createdAt: afterDoc.createdAt}, {_id: {$gt: afterDoc._id}}]},
            ];
          }
        }
        const batch = await Comment.find(q)
          .sort({createdAt: 1, _id: 1})
          .limit(limit)
          .populate("authorId", AUTHOR_SELECT)
          .lean();
        const formatted = await attachReplyingTo(batch as unknown as Array<Record<string, unknown>>);
        const nextCursor =
          batch.length === limit && batch[batch.length - 1]?._id
            ? String(batch[batch.length - 1]._id)
            : null;
        return res.json({
          replies: formatted,
          hasMore: batch.length === limit,
          nextCursor,
          totalInThread: totalIndexed,
        });
      }

      const hasLegacy = await Comment.exists({postId, parentId: rootObj, isActive: true});
      if (!hasLegacy) {
        return res.json({replies: [], hasMore: false, nextCursor: null, totalInThread: 0});
      }

      const all = await legacyThreadDescendants(postIdObj, rootObj, COMMENT_LEGACY_THREAD_CAP);
      const populated = await populateLeanCommentAuthors(all);
      let start = COMMENT_THREAD_PREVIEW;
      if (after) {
        const idx = populated.findIndex((x) => String(x._id) === after);
        start = idx >= 0 ? idx + 1 : COMMENT_THREAD_PREVIEW;
      }
      const slice = populated.slice(start, start + limit);
      const formatted = await attachReplyingTo(slice);
      const nextCursor =
        slice.length === limit && slice[slice.length - 1]?._id ? String(slice[slice.length - 1]._id) : null;
      const hasMore = start + slice.length < populated.length;
      return res.json({
        replies: formatted,
        hasMore,
        nextCursor,
        totalInThread: populated.length,
      });
    } catch (err) {
      console.error("[posts] comments thread error:", err);
      return res.status(500).json({ message: "Failed to fetch thread" });
    }
  },
);

// ── GET /posts/:id/comments ─────────────────────────────────────────
postsRouter.get(
  "/:id/comments",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const skip = (page - 1) * COMMENT_ROOT_PAGE;

      const post = await Post.findById(req.params.id).select("isDeleted isActive commentsCount");
      if (!post?.isActive || post.isDeleted) {
        return res.status(404).json({ message: "Post not found" });
      }

      const postIdObj = new mongoose.Types.ObjectId(String(req.params.id));

      const rootComments = await Comment.find({
        postId: req.params.id,
        isActive: true,
        parentId: { $exists: false },
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(COMMENT_ROOT_PAGE)
        .populate("authorId", AUTHOR_SELECT)
        .lean();

      if (rootComments.length === 0) {
        return res.json({
          comments: [],
          page,
          hasMore: false,
          totalCount: Number(post.commentsCount) || 0,
        });
      }

      const result = await Promise.all(
        rootComments.map(async (raw) => {
          const root = raw as unknown as Record<string, unknown>;
          const rootOid = root._id as mongoose.Types.ObjectId;
          const tr =
            (root.threadRootId as mongoose.Types.ObjectId | undefined) ?? (root._id as mongoose.Types.ObjectId);

          const replyFilter: Record<string, unknown> = {
            postId: req.params.id,
            isActive: true,
            threadRootId: tr,
            _id: { $ne: rootOid },
          };

          let total = await Comment.countDocuments(replyFilter);
          let previewDocs: Array<Record<string, unknown>> = [];

          if (total > 0) {
            const batch = await Comment.find(replyFilter)
              .sort({ createdAt: 1, _id: 1 })
              .limit(COMMENT_THREAD_PREVIEW)
              .populate("authorId", AUTHOR_SELECT)
              .lean();
            previewDocs = batch as unknown as Array<Record<string, unknown>>;
          } else {
            const hasLegacy = await Comment.exists({
              postId: req.params.id,
              parentId: rootOid,
              isActive: true,
            });
            if (hasLegacy) {
              const legacy = await legacyThreadDescendants(postIdObj, rootOid, COMMENT_LEGACY_THREAD_CAP);
              total = legacy.length;
              const slice = legacy.slice(0, COMMENT_THREAD_PREVIEW);
              previewDocs = await populateLeanCommentAuthors(slice);
            }
          }

          const previewFormatted = await attachReplyingTo(previewDocs);
          return {
            ...root,
            author: root.authorId,
            authorId: undefined,
            threadRootId: String(tr),
            replies: previewFormatted,
            threadReplyCount: total,
            hasMoreThreadReplies: total > previewFormatted.length,
            repliesCount: total,
            hasMoreReplies: total > previewFormatted.length,
          } as Record<string, unknown>;
        }),
      );

      return res.json({
        comments: result,
        page,
        hasMore: rootComments.length === COMMENT_ROOT_PAGE,
        totalCount: Number(post.commentsCount) || 0,
      });
    } catch (err) {
      console.error("[posts] comments error:", err);
      return res.status(500).json({ message: "Failed to fetch comments" });
    }
  },
);

// ── POST /posts/:id/comments ────────────────────────────────────────
postsRouter.post(
  "/:id/comments",
  requireVerifiedUser,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const user = req.dbUser!;
      const postId = String(req.params.id);
      const { text, parentId } = req.body as { text: string; parentId?: string };

      if (!text?.trim()) return res.status(400).json({ message: "Comment text required" });

      const postCheck = await Post.findById(postId).select("authorId isDeleted isActive");
      if (!postCheck?.isActive || postCheck.isDeleted) {
        return res.status(404).json({ message: "Post not found" });
      }

      const comment = await Comment.create({
        postId,
        authorId: user._id,
        text: text.trim(),
        parentId: parentId || undefined,
      });

      let threadRootId: mongoose.Types.ObjectId;
      if (!parentId) {
        threadRootId = comment._id as mongoose.Types.ObjectId;
        await Comment.updateOne({_id: comment._id}, {$set: {threadRootId}});
      } else {
        threadRootId = await resolveThreadRootId(String(parentId));
        await Comment.updateOne({_id: comment._id}, {$set: {threadRootId}});
      }

      const updated = await Post.findByIdAndUpdate(postId, { $inc: { commentsCount: 1 } }, {new: true});
      const commentsCount = updated?.commentsCount ?? 0;

      const populated = await Comment.findById(comment._id)
        .populate("authorId", AUTHOR_SELECT)
        .lean();

      let replyingTo: {userId: string; username: string} | undefined;
      if (parentId) {
        const p = await Comment.findById(parentId).populate("authorId", AUTHOR_SELECT).lean();
        const pa = p?.authorId as {_id: mongoose.Types.ObjectId; username?: string} | null;
        if (p && pa?._id) {
          replyingTo = {userId: String(pa._id), username: pa.username ?? "user"};
        }
      }

      const result = {
        ...populated,
        author: populated?.authorId,
        authorId: undefined,
        threadRootId: String(threadRootId),
        replyingTo,
      };
      emitPostComment(postId, commentsCount, result as object);

      // Persist + broadcast notification to post author
      if (updated && String(updated.authorId) !== String(user._id)) {
        createNotification({
          recipientId: updated.authorId,
          actorId: user._id,
          type: "comment",
          postId,
          message: `${user.displayName} commented: ${text.trim().slice(0, 50)}`,
        });
        emitNotification(
          String(updated.authorId),
          "comment",
          String(user._id),
          postId,
          `${user.displayName} commented: ${text.trim().slice(0, 50)}`,
        );
      }

      return res.status(201).json({ comment: result });
    } catch (err) {
      console.error("[posts] add comment error:", err);
      return res.status(500).json({ message: "Failed to add comment" });
    }
  },
);

// ── DELETE /posts/:id/comments/:commentId ──────────────────────────
postsRouter.delete(
  "/:id/comments/:commentId",
  requireVerifiedUser,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const user = req.dbUser!;
      const postId = String(req.params.id);
      const comment = await Comment.findById(req.params.commentId);
      if (!comment || !comment.isActive) return res.status(404).json({ message: "Comment not found" });
      if (String(comment.postId) !== postId) {
        return res.status(404).json({ message: "Comment not found" });
      }
      const post = await Post.findById(postId).select("authorId").lean();
      const isPostOwner = post != null && String(post.authorId) === String(user._id);
      if (!isPostOwner && String(comment.authorId) !== String(user._id)) {
        return res.status(403).json({ message: "Not authorized" });
      }
      comment.isActive = false;
      await comment.save();
      await Post.findByIdAndUpdate(req.params.id, { $inc: { commentsCount: -1 } });
      return res.json({ message: "Comment deleted" });
    } catch (err) {
      console.error("[posts] delete comment error:", err);
      return res.status(500).json({ message: "Failed to delete comment" });
    }
  },
);

// ── POST /posts/:id/save (toggle) ───────────────────────────────────
postsRouter.post(
  "/:id/save",
  requireVerifiedUser,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const user = req.dbUser!;
      const postId = String(req.params.id);
      if (!mongoose.Types.ObjectId.isValid(postId)) {
        return res.status(404).json({ message: "Post not found" });
      }
      const exists = await Post.findOne({_id: postId, ...PROFILE_OR_SAVED_POST}).select("_id").lean();
      if (!exists) return res.status(404).json({ message: "Post not found" });

      const col = mongoose.connection.collection("saved_posts");
      const oid = new mongoose.Types.ObjectId(postId);
      const uid = user._id as mongoose.Types.ObjectId;
      const row = await col.findOne({
        postId: oid,
        $or: [{ userId: uid }, { userId: String(uid) }],
      });
      if (row) {
        await col.deleteOne({_id: row._id});
        return res.json({saved: false});
      }
      await col.insertOne({userId: uid, postId: oid, createdAt: new Date()});
      return res.json({saved: true});
    } catch (err) {
      console.error("[posts] save toggle error:", err);
      return res.status(500).json({ message: "Failed to update saved" });
    }
  },
);

// ── POST /posts/:id/feedback (interested / not_interested) ──────────
postsRouter.post(
  "/:id/feedback",
  requireVerifiedUser,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const user = req.dbUser!;
      const postId = String(req.params.id);
      if (!mongoose.Types.ObjectId.isValid(postId)) {
        return res.status(404).json({ message: "Post not found" });
      }
      const { signal } = req.body as { signal?: string };
      if (signal !== "interested" && signal !== "not_interested") {
        return res.status(400).json({ message: "signal must be interested or not_interested" });
      }
      const post = await Post.findById(postId).select("authorId isActive isDeleted").lean();
      if (!post || !post.isActive || post.isDeleted) {
        return res.status(404).json({ message: "Post not found" });
      }
      const col = mongoose.connection.collection("reel_feedback_signals");
      await col.updateOne(
        { userId: user._id, postId: post._id },
        {
          $set: { signal, authorId: post.authorId, updatedAt: new Date() },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true },
      );
      if (signal === "not_interested") {
        await mongoose.connection.collection("post_hides").updateOne(
          { postId: post._id, userId: user._id },
          {
            $setOnInsert: { postId: post._id, userId: user._id, createdAt: new Date() },
          },
          { upsert: true },
        );
      } else {
        await Post.updateOne({_id: post._id}, {$inc: {trendingScore: 0.25}}).catch(() => null);
        recomputeTrending(postId);
      }
      return res.json({ ok: true });
    } catch (err) {
      console.error("[posts] feedback error:", err);
      return res.status(500).json({ message: "Failed to record feedback" });
    }
  },
);

// ── POST /posts/:id/hide ────────────────────────────────────────────
postsRouter.post(
  "/:id/hide",
  requireVerifiedUser,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const user = req.dbUser!;
      const hidePostId = String(req.params.id);
      await mongoose.connection.collection("post_hides").updateOne(
        { postId: new mongoose.Types.ObjectId(hidePostId), userId: user._id },
        { $setOnInsert: { postId: new mongoose.Types.ObjectId(hidePostId), userId: user._id, createdAt: new Date() } },
        { upsert: true },
      );
      return res.json({ hidden: true });
    } catch (err) {
      console.error("[posts] hide error:", err);
      return res.status(500).json({ message: "Failed to hide post" });
    }
  },
);

// ── POST /posts/:id/report ──────────────────────────────────────────
postsRouter.post(
  "/:id/report",
  requireVerifiedUser,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const user = req.dbUser!;
      const { reason = "other" } = req.body as { reason?: string };
      const reportPostId = String(req.params.id);
      await mongoose.connection.collection("post_reports").updateOne(
        { postId: new mongoose.Types.ObjectId(reportPostId), reporterId: user._id },
        { $set: { reason, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
        { upsert: true },
      );
      return res.json({ reported: true });
    } catch (err) {
      console.error("[posts] report error:", err);
      return res.status(500).json({ message: "Failed to report post" });
    }
  },
);

// ── POST /posts/:id/share ───────────────────────────────────────────
postsRouter.post(
  "/:id/share",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    Post.findOneAndUpdate(
      { _id: req.params.id, isActive: true, isDeleted: { $ne: true } },
      { $inc: { sharesCount: 1 } },
    ).then(() => recomputeTrending(String(req.params.id))).catch(() => null);
    return res.json({ ok: true });
  },
);

// ── POST /posts/:id/comments/:commentId/like ────────────────────────
postsRouter.post(
  "/:id/comments/:commentId/like",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const commentId = String(req.params.commentId);
      const userId = req.dbUser!._id;
      const col = mongoose.connection.collection("comment_likes");
      const existing = await col.findOne({ commentId, userId });
      if (existing) {
        await col.deleteOne({ commentId, userId });
        await Comment.updateOne({ _id: commentId }, { $inc: { likesCount: -1 } });
        return res.json({ liked: false });
      } else {
        await col.insertOne({ commentId, userId, createdAt: new Date() });
        const updated = await Comment.findByIdAndUpdate(commentId, { $inc: { likesCount: 1 } }, { new: true });
        return res.json({ liked: true, likesCount: updated?.likesCount ?? 0 });
      }
    } catch (err) {
      console.error("[posts] comment like error:", err);
      return res.status(500).json({ message: "Failed to like comment" });
    }
  },
);

// ── GET /posts/:id/analytics ────────────────────────────────────────
postsRouter.get(
  "/:id/analytics",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const post = await Post.findById(req.params.id)
        .select("viewsCount impressionsCount likesCount commentsCount sharesCount avgWatchTimeMs trendingScore authorId mediaType createdAt")
        .lean();
      if (!post) return res.status(404).json({ message: "Post not found" });
      if (String(post.authorId) !== String(req.dbUser!._id)) {
        return res.status(403).json({ message: "Not your post" });
      }
      const ageHours = (Date.now() - new Date(post.createdAt).getTime()) / 3_600_000;
      return res.json({
        viewsCount: post.viewsCount,
        impressionsCount: post.impressionsCount,
        likesCount: post.likesCount,
        commentsCount: post.commentsCount,
        sharesCount: post.sharesCount,
        avgWatchTimeMs: post.avgWatchTimeMs,
        trendingScore: Number(post.trendingScore?.toFixed(4) ?? 0),
        reachRate: post.impressionsCount > 0 ? Number((post.viewsCount / post.impressionsCount * 100).toFixed(1)) : 0,
        engagementRate: post.viewsCount > 0
          ? Number(((post.likesCount + post.commentsCount) / post.viewsCount * 100).toFixed(2))
          : 0,
        ageHours: Math.round(ageHours),
      });
    } catch (err) {
      console.error("[posts] analytics error:", err);
      return res.status(500).json({ message: "Failed to fetch analytics" });
    }
  },
);

// ── GET /posts/trending ─────────────────────────────────────────────
postsRouter.get(
  "/trending",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
      const posts = await Post.find({ isActive: true, isDeleted: { $ne: true } })
        .sort({ trendingScore: -1, createdAt: -1 })
        .limit(limit)
        .populate("authorId", AUTHOR_SELECT)
        .lean();
      const result = posts.map((p) => ({
        ...p,
        author: p.authorId,
        authorId: undefined,
      }));
      return res.json({ posts: result });
    } catch (err) {
      console.error("[posts] trending error:", err);
      return res.status(500).json({ message: "Failed to fetch trending" });
    }
  },
);
