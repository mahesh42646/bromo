import { createHash } from "node:crypto";
import { Router, type Response } from "express";
import mongoose from "mongoose";
import {
  requireFirebaseToken,
  requireVerifiedUser,
  type FirebaseAuthedRequest,
} from "../middleware/firebaseAuth.js";
import { Post } from "../models/Post.js";
import { StorySeen } from "../models/StorySeen.js";
import { Like } from "../models/Like.js";
import { Comment } from "../models/Comment.js";
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

export const postsRouter = Router();

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

const AUTHOR_SELECT = "username displayName profilePicture isPrivate emailVerified followersCount";
const PAGE_SIZE = 20;

/** Public listings: active and not soft-deleted. */
const VISIBLE_POST = { isActive: true, isDeleted: { $ne: true } } as const;

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
  return {
    ...p,
    mediaUrl,
    thumbnailUrl,
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

// ── GET /posts/feed ─────────────────────────────────────────────────
postsRouter.get(
  "/feed",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const dbUser = req.dbUser;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const cursor = req.query.cursor as string | undefined;
      const skip = cursor ? 0 : (page - 1) * PAGE_SIZE;

      // Fetch following list in parallel with nothing yet — resolved immediately
      let followingIds: mongoose.Types.ObjectId[] = [];
      if (dbUser) {
        const follows = await Follow.find({ followerId: dbUser._id, status: "accepted" })
          .select("followingId")
          .lean();
        followingIds = follows.map((f) => f.followingId);
      }

      // When the user follows nobody yet, fall back to explore (public posts),
      // so the feed is never empty on first open.
      const hasFollows = followingIds.length > 0;
      const feedTypes = { type: { $in: ["post", "reel"] } } as const;
      const baseQuery = dbUser && hasFollows
        ? { authorId: { $in: [...followingIds, dbUser._id] }, ...feedTypes, ...VISIBLE_POST }
        : { ...feedTypes, ...VISIBLE_POST };

      const query = cursor
        ? { ...baseQuery, _id: { $lt: new mongoose.Types.ObjectId(cursor) } }
        : baseQuery;

      // Run posts query + likes query in parallel
      const [posts, likes] = await Promise.all([
        Post.find(query)
          .sort({ _id: -1 })
          .skip(cursor ? 0 : skip)
          .limit(PAGE_SIZE)
          .populate("authorId", AUTHOR_SELECT)
          .lean(),
        dbUser
          ? Like.find({ userId: dbUser._id, targetType: "post" })
              .select("targetId")
              .lean()
          : Promise.resolve([]),
      ]);

      const likedSet = new Set(likes.map((l) => String(l.targetId)));
      const followingSet = new Set(followingIds.map(String));
      const result = posts.map((p) =>
        normalizePost(p as unknown as Record<string, unknown>, likedSet, followingSet, String(dbUser?._id)),
      );
      const nextCursor = posts.length === PAGE_SIZE ? String(posts[posts.length - 1]._id) : null;

      res.setHeader("Cache-Control", "private, no-store");
      return res.json({ posts: result, page, hasMore: posts.length === PAGE_SIZE, nextCursor });
    } catch (err) {
      console.error("[posts] feed error:", err);
      return res.status(500).json({ message: "Failed to fetch feed" });
    }
  },
);

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

      const baseQuery = { type: "reel" as const, ...VISIBLE_POST };
      const query = cursor
        ? { ...baseQuery, _id: { $lt: new mongoose.Types.ObjectId(cursor) } }
        : baseQuery;

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
      const followingSet = new Set(follows.map((f) => String(f.followingId)));

      const result = posts.map((p) =>
        normalizePost(p as unknown as Record<string, unknown>, likedSet, followingSet, String(dbUser?._id)),
      );
      const nextCursor = posts.length === PAGE_SIZE ? String(posts[posts.length - 1]._id) : null;

      res.setHeader("Cache-Control", "private, no-store");
      return res.json({ posts: result, page, hasMore: posts.length === PAGE_SIZE, nextCursor });
    } catch (err) {
      console.error("[posts] reels error:", err);
      return res.status(500).json({ message: "Failed to fetch reels" });
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
        ? await Follow.find({ followerId: dbUser._id, status: "accepted" }).select("followingId").lean()
        : [];
      const followingIds = follows.map((f) => f.followingId);
      const excludeIds = dbUser ? [...followingIds, dbUser._id] : [];

      const query = excludeIds.length
        ? { type: { $in: ["post", "reel"] }, ...VISIBLE_POST, authorId: { $nin: excludeIds } }
        : { type: { $in: ["post", "reel"] }, ...VISIBLE_POST };

      const [posts, likes] = await Promise.all([
        Post.find(query)
          .sort({ viewsCount: -1, createdAt: -1 })
          .skip(skip)
          .limit(PAGE_SIZE)
          .populate("authorId", AUTHOR_SELECT)
          .lean(),
        dbUser
          ? Like.find({ userId: dbUser._id, targetType: "post" }).select("targetId").lean()
          : Promise.resolve([]),
      ]);

      const followingSet = new Set(followingIds.map(String));
      const likedSet = new Set(likes.map((l) => String(l.targetId)));
      const result = posts.map((p) =>
        normalizePost(p as unknown as Record<string, unknown>, likedSet, followingSet, String(dbUser?._id)),
      );

      res.setHeader("Cache-Control", "private, no-store");
      return res.json({ posts: result, page, hasMore: posts.length === PAGE_SIZE });
    } catch (err) {
      console.error("[posts] explore error:", err);
      return res.status(500).json({ message: "Failed to fetch explore" });
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
      }).select("followingId");
      const followingIds = follows.map((f) => f.followingId);
      const authorIds = [dbUser._id, ...followingIds];

      const match = {
        type: "story" as const,
        ...VISIBLE_POST,
        authorId: { $in: authorIds },
        expiresAt: { $gt: new Date() },
      };

      const slim = await Post.find(match)
        .select({ _id: 1, updatedAt: 1 })
        .sort({ createdAt: -1 })
        .lean();

      const slimIds = slim.map((s) => s._id);
      const seenForEtag = await StorySeen.find({
        viewerId: dbUser._id,
        storyPostId: { $in: slimIds },
      })
        .select({ storyPostId: 1 })
        .lean();
      const seenSortedIds = seenForEtag.map((r) => String(r.storyPostId)).sort().join("|");

      const etag = storiesTrayEtag(slim, seenSortedIds);
      const inm = normalizeIfNoneMatch(req.get("if-none-match"));
      if (inm && inm === etag) {
        res.setHeader("ETag", etag);
        res.set("Cache-Control", "private, max-age=120, stale-while-revalidate=300");
        return res.status(304).end();
      }

      const stories = await Post.find(match)
        .sort({ createdAt: -1 })
        .populate("authorId", AUTHOR_SELECT)
        .lean();

      const allIds = stories.map((s) => s._id);
      const seenRows = await StorySeen.find({
        viewerId: dbUser._id,
        storyPostId: { $in: allIds },
      })
        .select({ storyPostId: 1 })
        .lean();
      const seenSet = new Set(seenRows.map((r) => String(r.storyPostId)));

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

      res.setHeader("ETag", etag);
      res.set("Cache-Control", "private, max-age=120, stale-while-revalidate=300");
      return res.json({ stories: groupsArr });
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

      const mediaUrl =
        typeof src.mediaUrl === "string" ? rewritePublicMediaUrl(src.mediaUrl) : String(src.mediaUrl ?? "");
      const thumbnailUrl =
        typeof src.thumbnailUrl === "string" && src.thumbnailUrl.trim()
          ? rewritePublicMediaUrl(src.thumbnailUrl)
          : "";

      const post = await Post.create({
        authorId: user._id,
        type: "story",
        mediaUrl,
        thumbnailUrl,
        mediaType: "video",
        caption: "",
        location: "",
        music: typeof src.music === "string" ? src.music : "",
        tags: [],
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        isDeleted: false,
      });

      await User.findByIdAndUpdate(user._id, { $inc: { postsCount: 1 } });
      const populated = await Post.findById(post._id).populate("authorId", AUTHOR_SELECT).lean();
      const result = { ...populated, author: populated?.authorId, authorId: undefined };
      emitStoryNew(String(user._id));
      return res.status(201).json({ post: result });
    } catch (err) {
      console.error("[posts] story-from-reel error:", err);
      return res.status(500).json({ message: "Failed to add reel to story" });
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
      const { userId } = req.params;
      const type = (req.query.type as string) || "post";
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const skip = (page - 1) * PAGE_SIZE;

      const targetUser = await User.findById(userId).lean();
      if (!targetUser) return res.status(404).json({ message: "User not found" });

      const posts = await Post.find({
        authorId: userId,
        type,
        ...VISIBLE_POST,
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(PAGE_SIZE)
        .lean();

      const likedSet = new Set<string>();
      if (dbUser) {
        const likes = await Like.find({
          userId: dbUser._id,
          targetType: "post",
          targetId: { $in: posts.map((p) => p._id) },
        }).select("targetId");
        likes.forEach((l) => likedSet.add(String(l.targetId)));
      }

      const result = posts.map((p) => ({
        ...p,
        likesCount: Number(p.likesCount) || 0,
        commentsCount: Number(p.commentsCount) || 0,
        viewsCount: Number(p.viewsCount) || 0,
        isLiked: likedSet.has(String(p._id)),
      }));
      return res.json({ posts: result, page, hasMore: posts.length === PAGE_SIZE });
    } catch (err) {
      console.error("[posts] user posts error:", err);
      return res.status(500).json({ message: "Failed to fetch user posts" });
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
      const { type, mediaUrl, thumbnailUrl, mediaType, caption, location, music, tags, storyMeta } = req.body as {
        type: "post" | "reel" | "story";
        mediaUrl: string;
        thumbnailUrl?: string;
        mediaType: "image" | "video";
        caption?: string;
        location?: string;
        music?: string;
        tags?: string[];
        storyMeta?: { bgColor?: string; overlays?: unknown[] };
      };

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

      const expiresAt = type === "story" ? new Date(Date.now() + 24 * 60 * 60 * 1000) : undefined;

      const post = await Post.create({
        authorId: user._id,
        type,
        mediaUrl: mediaUrl ?? "color-bg",
        thumbnailUrl: thumbnailUrl ?? "",
        mediaType: mediaType ?? "image",
        caption: caption?.trim() ?? "",
        location: location?.trim() ?? "",
        music: music?.trim() ?? "",
        tags: tags ?? [],
        expiresAt,
        isDeleted: false,
        ...(type === "story" && storyMeta ? { storyMeta } : {}),
      });

      await User.findByIdAndUpdate(user._id, { $inc: { postsCount: 1 } });

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

      return res.status(201).json({ post: result });
    } catch (err) {
      console.error("[posts] create error:", err);
      return res.status(500).json({ message: "Failed to create post" });
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
      await User.findByIdAndUpdate(user._id, { $inc: { postsCount: -1 } });
      emitPostDelete(String(req.params.id));
      return res.json({ message: "Post deleted" });
    } catch (err) {
      console.error("[posts] delete error:", err);
      return res.status(500).json({ message: "Failed to delete post" });
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

      const existing = await Like.findOne({ targetId: postId, userId: user._id, targetType: "post" });
      const targetPost = await Post.findById(postId).select("authorId isDeleted isActive");
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

    Post.findOneAndUpdate(
      { _id: postId, isActive: true, isDeleted: { $ne: true } },
      { $inc: { viewsCount: 1, impressionsCount: 1, totalWatchTimeMs: watchMs } },
      { new: true },
    ).then((p) => {
      if (p && p.viewsCount > 0) {
        const avg = p.totalWatchTimeMs / p.viewsCount;
        Post.updateOne({ _id: postId }, { $set: { avgWatchTimeMs: avg } }).catch(() => null);
      }
      recomputeTrending(postId);
    }).catch(() => null);

    return res.json({ ok: true });
  },
);

// ── GET /posts/:id/comments ─────────────────────────────────────────
postsRouter.get(
  "/:id/comments",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const skip = (page - 1) * 30;

      const post = await Post.findById(req.params.id).select("isDeleted isActive");
      if (!post?.isActive || post.isDeleted) {
        return res.status(404).json({ message: "Post not found" });
      }

      const rootComments = await Comment.find({
        postId: req.params.id,
        isActive: true,
        parentId: { $exists: false },
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(30)
        .populate("authorId", AUTHOR_SELECT)
        .lean();

      if (rootComments.length === 0) {
        return res.json({ comments: [], page, hasMore: false });
      }

      // Fetch top 3 replies per root comment (one query)
      const rootIds = rootComments.map((c) => c._id);
      const replies = await Comment.find({
        postId: req.params.id,
        isActive: true,
        parentId: { $in: rootIds },
      })
        .sort({ createdAt: 1 })
        .limit(rootComments.length * 10)
        .populate("authorId", AUTHOR_SELECT)
        .lean();

      const replyMap = new Map<string, typeof replies>();
      for (const r of replies) {
        const pid = String(r.parentId);
        if (!replyMap.has(pid)) replyMap.set(pid, []);
        replyMap.get(pid)!.push(r);
      }

      const result = rootComments.map((c) => {
        const id = String(c._id);
        const reps = (replyMap.get(id) ?? []).slice(0, 3).map((r) => ({
          ...r,
          author: r.authorId,
          authorId: undefined,
        }));
        const totalReplies = replyMap.get(id)?.length ?? 0;
        return {
          ...c,
          author: c.authorId,
          authorId: undefined,
          replies: reps,
          repliesCount: totalReplies,
          hasMoreReplies: totalReplies > 3,
        };
      });

      return res.json({ comments: result, page, hasMore: rootComments.length === 30 });
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

      const updated = await Post.findByIdAndUpdate(postId, { $inc: { commentsCount: 1 } }, {new: true});
      const commentsCount = updated?.commentsCount ?? 0;

      const populated = await Comment.findById(comment._id)
        .populate("authorId", AUTHOR_SELECT)
        .lean();

      const result = { ...populated, author: populated?.authorId, authorId: undefined };
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
      const comment = await Comment.findById(req.params.commentId);
      if (!comment || !comment.isActive) return res.status(404).json({ message: "Comment not found" });
      if (String(comment.authorId) !== String(user._id)) {
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
