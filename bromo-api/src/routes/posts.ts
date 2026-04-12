import { Router, type Response } from "express";
import mongoose from "mongoose";
import {
  requireFirebaseToken,
  requireVerifiedUser,
  type FirebaseAuthedRequest,
} from "../middleware/firebaseAuth.js";
import { Post } from "../models/Post.js";
import { Like } from "../models/Like.js";
import { Comment } from "../models/Comment.js";
import { Follow } from "../models/Follow.js";
import { User } from "../models/User.js";
import {
  emitPostNew,
  emitPostLike,
  emitPostComment,
  emitPostDelete,
  emitStoryNew,
  emitNotification,
} from "../services/socketService.js";

export const postsRouter = Router();

const AUTHOR_SELECT = "username displayName profilePicture isPrivate emailVerified followersCount";
const PAGE_SIZE = 20;

function normalizePost(p: Record<string, unknown>, likedSet: Set<string>, followingSet: Set<string>, dbUserId?: string) {
  const author = p.authorId as Record<string, unknown> | null;
  const authorOid = author ? String((author as {_id: unknown})._id) : "";
  const isSelf = Boolean(dbUserId && authorOid && authorOid === dbUserId);
  const isFollowing = Boolean(
    dbUserId && authorOid && (isSelf || followingSet.has(authorOid)),
  );
  return {
    ...p,
    likesCount: Number(p.likesCount) || 0,
    commentsCount: Number(p.commentsCount) || 0,
    viewsCount: Number(p.viewsCount) || 0,
    isLiked: likedSet.has(String(p._id)),
    author: author ? {
      ...author,
      followersCount: Number(author.followersCount) || 0,
    } : null,
    isFollowing,
    authorId: undefined,
  };
}

function buildUrl(req: FirebaseAuthedRequest, filename: string): string {
  if (filename.startsWith("http")) return filename;
  const proto = (Array.isArray(req.headers["x-forwarded-proto"])
    ? req.headers["x-forwarded-proto"][0]
    : req.headers["x-forwarded-proto"]) ?? req.protocol;
  const host = req.get("host") ?? "";
  return `${proto}://${host}/uploads/${filename}`;
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

      let followingIds: mongoose.Types.ObjectId[] = [];
      if (dbUser) {
        const follows = await Follow.find({
          followerId: dbUser._id,
          status: "accepted",
        }).select("followingId");
        followingIds = follows.map((f) => f.followingId);
      }

      const baseQuery = dbUser
        ? { authorId: { $in: [...followingIds, dbUser._id] }, type: "post", isActive: true }
        : { type: "post", isActive: true };

      const query = cursor
        ? { ...baseQuery, _id: { $lt: new mongoose.Types.ObjectId(cursor) } }
        : baseQuery;

      const posts = await Post.find(query)
        .sort({ _id: -1 })
        .skip(cursor ? 0 : skip)
        .limit(PAGE_SIZE)
        .populate("authorId", AUTHOR_SELECT)
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

      const followingSet = new Set(followingIds.map(String));
      const result = posts.map((p) => normalizePost(p as unknown as Record<string, unknown>, likedSet, followingSet, String(dbUser?._id)));
      const nextCursor = posts.length === PAGE_SIZE ? String(posts[posts.length - 1]._id) : null;

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

      const baseQuery = { type: "reel" as const, isActive: true };
      const query = cursor
        ? { ...baseQuery, _id: { $lt: new mongoose.Types.ObjectId(cursor) } }
        : baseQuery;

      const posts = await Post.find(query)
        .sort({ _id: -1 })
        .skip(skip)
        .limit(PAGE_SIZE)
        .populate("authorId", AUTHOR_SELECT)
        .lean();

      const likedSet = new Set<string>();
      let followingSet = new Set<string>();
      if (dbUser) {
        const likes = await Like.find({
          userId: dbUser._id,
          targetType: "post",
          targetId: { $in: posts.map((p) => p._id) },
        }).select("targetId");
        likes.forEach((l) => likedSet.add(String(l.targetId)));

        const follows = await Follow.find({
          followerId: dbUser._id,
          status: "accepted",
        }).select("followingId");
        followingSet = new Set(follows.map((f) => String(f.followingId)));
      }

      const result = posts.map((p) =>
        normalizePost(p as unknown as Record<string, unknown>, likedSet, followingSet, String(dbUser?._id)),
      );
      const nextCursor = posts.length === PAGE_SIZE ? String(posts[posts.length - 1]._id) : null;

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

      let excludeIds: mongoose.Types.ObjectId[] = [];
      if (dbUser) {
        const follows = await Follow.find({
          followerId: dbUser._id,
          status: "accepted",
        }).select("followingId");
        excludeIds = [...follows.map((f) => f.followingId), dbUser._id];
      }

      const query = excludeIds.length
        ? { type: { $in: ["post", "reel"] }, isActive: true, authorId: { $nin: excludeIds } }
        : { type: { $in: ["post", "reel"] }, isActive: true };

      const posts = await Post.find(query)
        .sort({ viewsCount: -1, createdAt: -1 })
        .skip(skip)
        .limit(PAGE_SIZE)
        .populate("authorId", AUTHOR_SELECT)
        .lean();

      let followingSet = new Set<string>();
      const likedSet = new Set<string>();
      if (dbUser) {
        const follows = await Follow.find({
          followerId: dbUser._id,
          status: "accepted",
        }).select("followingId");
        followingSet = new Set(follows.map((f) => String(f.followingId)));

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
      if (!dbUser) return res.json({ stories: [] });

      const follows = await Follow.find({
        followerId: dbUser._id,
        status: "accepted",
      }).select("followingId");
      const followingIds = follows.map((f) => f.followingId);
      const authorIds = [dbUser._id, ...followingIds];

      const stories = await Post.find({
        type: "story",
        isActive: true,
        authorId: { $in: authorIds },
        expiresAt: { $gt: new Date() },
      })
        .sort({ createdAt: -1 })
        .populate("authorId", AUTHOR_SELECT)
        .lean();

      const grouped: Record<string, { author: unknown; stories: unknown[] }> = {};
      for (const s of stories) {
        const authorId = String((s.authorId as { _id: mongoose.Types.ObjectId })._id);
        if (!grouped[authorId]) {
          grouped[authorId] = { author: s.authorId, stories: [] };
        }
        grouped[authorId].stories.push({ ...s, authorId: undefined });
      }

      return res.json({ stories: Object.values(grouped) });
    } catch (err) {
      console.error("[posts] stories error:", err);
      return res.status(500).json({ message: "Failed to fetch stories" });
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
        isActive: true,
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
      const dbUser = req.dbUser;
      const post = await Post.findById(req.params.id)
        .populate("authorId", AUTHOR_SELECT)
        .lean();
      if (!post || !post.isActive) return res.status(404).json({ message: "Post not found" });

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
      const { type, mediaUrl, thumbnailUrl, mediaType, caption, location, music, tags } = req.body as {
        type: "post" | "reel" | "story";
        mediaUrl: string;
        thumbnailUrl?: string;
        mediaType: "image" | "video";
        caption?: string;
        location?: string;
        music?: string;
        tags?: string[];
      };

      if (!mediaUrl || !mediaType || !type) {
        return res.status(400).json({ message: "mediaUrl, mediaType and type are required" });
      }

      const expiresAt = type === "story" ? new Date(Date.now() + 24 * 60 * 60 * 1000) : undefined;

      const post = await Post.create({
        authorId: user._id,
        type,
        mediaUrl,
        thumbnailUrl: thumbnailUrl ?? "",
        mediaType,
        caption: caption?.trim() ?? "",
        location: location?.trim() ?? "",
        music: music?.trim() ?? "",
        tags: tags ?? [],
        expiresAt,
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
      if (existing) {
        await existing.deleteOne();
        const updated = await Post.findByIdAndUpdate(postId, { $inc: { likesCount: -1 } }, {new: true});
        const count = updated?.likesCount ?? 0;
        emitPostLike(postId, count, false, String(user._id));
        return res.json({ liked: false, likesCount: count });
      }

      await Like.create({ targetId: postId, userId: user._id, targetType: "post" });
      const post = await Post.findByIdAndUpdate(postId, { $inc: { likesCount: 1 } }, { new: true });
      const count = post?.likesCount ?? 0;
      emitPostLike(postId, count, true, String(user._id));

      // Notify post author
      if (post && String(post.authorId) !== String(user._id)) {
        emitNotification(
          String(post.authorId),
          "like",
          String(user._id),
          postId,
          `${user.displayName} liked your post`,
        );
      }

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
    try {
      await Post.findByIdAndUpdate(req.params.id, { $inc: { viewsCount: 1 } });
      return res.json({ ok: true });
    } catch {
      return res.json({ ok: true });
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
      const skip = (page - 1) * 30;

      const comments = await Comment.find({
        postId: req.params.id,
        isActive: true,
        parentId: { $exists: false },
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(30)
        .populate("authorId", AUTHOR_SELECT)
        .lean();

      const result = comments.map((c) => ({
        ...c,
        author: c.authorId,
        authorId: undefined,
      }));

      return res.json({ comments: result, page, hasMore: comments.length === 30 });
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

      // Notify post author
      if (updated && String(updated.authorId) !== String(user._id)) {
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
