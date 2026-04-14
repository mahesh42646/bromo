import { Router } from "express";
import mongoose from "mongoose";
import { User } from "../models/User.js";
import { Admin } from "../models/Admin.js";
import { Post } from "../models/Post.js";
import { authorPostsCountWasBumped } from "../utils/authorPostsCount.js";
import { requireAdminToken, type AuthedRequest } from "../middleware/authBearer.js";
import { emitPostDelete } from "../services/socketService.js";
import { deleteLocalFilesForMediaUrls } from "../utils/uploadFiles.js";
import { rewritePublicMediaUrl } from "../utils/publicMediaUrl.js";

const router = Router();

const POST_AUTHOR_SELECT = "username displayName profilePicture isPrivate emailVerified followersCount";

/* ── Platform users ───────────────────────────────────────────────────── */

router.get("/users", requireAdminToken, async (req: AuthedRequest, res) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
    const limit = Math.min(100, parseInt(String(req.query.limit ?? "20"), 10));
    const search = String(req.query.search ?? "").trim();
    const provider = String(req.query.provider ?? "");
    const status = String(req.query.status ?? "");
    const onboarding = String(req.query.onboarding ?? "");

    type Filter = {
      $or?: Array<Record<string, { $regex: string; $options: string }>>;
      provider?: string;
      isActive?: boolean;
      onboardingComplete?: boolean;
    };

    const filter: Filter = {};
    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: "i" } },
        { displayName: { $regex: search, $options: "i" } },
        { username: { $regex: search, $options: "i" } },
      ];
    }
    if (provider === "email" || provider === "google") filter.provider = provider;
    if (status === "active") filter.isActive = true;
    if (status === "inactive") filter.isActive = false;
    if (onboarding === "complete") filter.onboardingComplete = true;
    if (onboarding === "pending") filter.onboardingComplete = false;

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("-firebaseUid -__v")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    return res.json({ users, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("adminUsers GET /users", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/users/stats", requireAdminToken, async (_req: AuthedRequest, res) => {
  try {
    const [total, active, inactive, pendingOnboarding, google] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ isActive: false }),
      User.countDocuments({ onboardingComplete: false }),
      User.countDocuments({ provider: "google" }),
    ]);
    return res.json({ total, active, inactive, pendingOnboarding, google });
  } catch (err) {
    console.error("adminUsers GET /users/stats", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/users/:id/content", requireAdminToken, async (req: AuthedRequest, res) => {
  try {
    const userId = String(req.params.id);
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
    const limit = Math.min(100, parseInt(String(req.query.limit ?? "30"), 10));
    const type = String(req.query.type ?? "all");
    const includeDeleted = String(req.query.includeDeleted ?? "") === "true";

    const exists = await User.findById(userId).select("_id").lean();
    if (!exists) return res.status(404).json({ message: "User not found" });

    const filter: Record<string, unknown> = { authorId: new mongoose.Types.ObjectId(userId) };
    if (!includeDeleted) {
      filter.isDeleted = { $ne: true };
    }
    if (type === "post" || type === "reel" || type === "story") {
      filter.type = type;
    }

    const [posts, total] = await Promise.all([
      Post.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("authorId", POST_AUTHOR_SELECT)
        .lean(),
      Post.countDocuments(filter),
    ]);

    const normalized = posts.map((p) => {
      const row = p as Record<string, unknown>;
      const mediaUrl = typeof row.mediaUrl === "string" ? rewritePublicMediaUrl(row.mediaUrl) : row.mediaUrl;
      const thumbnailUrl =
        typeof row.thumbnailUrl === "string" ? rewritePublicMediaUrl(row.thumbnailUrl) : row.thumbnailUrl;
      return {
        ...row,
        mediaUrl,
        thumbnailUrl,
        author: row.authorId,
        authorId: undefined,
      };
    });

    return res.json({ posts: normalized, page, limit, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("adminUsers GET /users/:id/content", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/users/:id", requireAdminToken, async (req: AuthedRequest, res) => {
  try {
    const user = await User.findById(req.params.id).select("-firebaseUid -__v").lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json(user);
  } catch (err) {
    console.error("adminUsers GET /users/:id", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/users/:id", requireAdminToken, async (req: AuthedRequest, res) => {
  try {
    const allowed = [
      "isActive",
      "displayName",
      "bio",
      "onboardingComplete",
      "username",
      "profilePicture",
      "website",
      "phone",
      "isPrivate",
    ] as const;
    const update: Partial<Record<(typeof allowed)[number], unknown>> = {};
    for (const key of allowed) {
      if (key in req.body) update[key] = req.body[key];
    }

    if (typeof update.username === "string") {
      const u = update.username.trim().toLowerCase();
      if (u.length < 4 || u.length > 30) {
        return res.status(400).json({ message: "Username must be 4–30 characters" });
      }
      const taken = await User.findOne({ username: u, _id: { $ne: req.params.id } }).select("_id").lean();
      if (taken) return res.status(409).json({ message: "Username already taken" });
      update.username = u;
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true, select: "-firebaseUid -__v" },
    ).lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json(user);
  } catch (err) {
    console.error("adminUsers PATCH /users/:id", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/users/:id", requireAdminToken, async (req: AuthedRequest, res) => {
  try {
    const result = await User.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ message: "User not found" });
    return res.json({ success: true });
  } catch (err) {
    console.error("adminUsers DELETE /users/:id", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/* ── Content moderation (any author) ─────────────────────────────────── */

router.patch("/posts/:postId", requireAdminToken, async (req: AuthedRequest, res) => {
  try {
    const { caption, location, isActive } = req.body as {
      caption?: string;
      location?: string;
      isActive?: boolean;
    };
    const update: Record<string, unknown> = {};
    if (typeof caption === "string") update.caption = caption.slice(0, 2200);
    if (typeof location === "string") update.location = location.slice(0, 200);
    if (typeof isActive === "boolean") update.isActive = isActive;
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }
    const post = await Post.findByIdAndUpdate(req.params.postId, { $set: update }, { new: true })
      .populate("authorId", POST_AUTHOR_SELECT)
      .lean();
    if (!post) return res.status(404).json({ message: "Post not found" });
    const row = post as Record<string, unknown>;
    return res.json({
      post: {
        ...row,
        author: row.authorId,
        authorId: undefined,
      },
    });
  } catch (err) {
    console.error("adminUsers PATCH /posts/:postId", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/posts/:postId", requireAdminToken, async (req: AuthedRequest, res) => {
  try {
    const permanent = Boolean((req.body as { permanent?: boolean })?.permanent);
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    if (permanent) {
      deleteLocalFilesForMediaUrls([post.mediaUrl, post.thumbnailUrl]);
      await Post.findByIdAndDelete(post._id);
      if (!post.isDeleted && authorPostsCountWasBumped(post)) {
        await User.findByIdAndUpdate(post.authorId, { $inc: { postsCount: -1 } });
      }
      emitPostDelete(String(post._id));
      return res.json({ ok: true, mode: "permanent" });
    }

    if (post.isDeleted) {
      return res.status(409).json({ message: "Post is already soft-deleted" });
    }
    post.isDeleted = true;
    post.deletedAt = new Date();
    post.isActive = false;
    await post.save();
    if (authorPostsCountWasBumped(post)) {
      await User.findByIdAndUpdate(post.authorId, { $inc: { postsCount: -1 } });
    }
    emitPostDelete(String(post._id));
    return res.json({ ok: true, mode: "soft" });
  } catch (err) {
    console.error("adminUsers DELETE /posts/:postId", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/posts/:postId/restore", requireAdminToken, async (req: AuthedRequest, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: "Post not found" });
    if (!post.isDeleted) {
      return res.status(409).json({ message: "Post is not soft-deleted" });
    }
    post.isDeleted = false;
    post.deletedAt = undefined;
    post.isActive = true;
    await post.save();
    if (authorPostsCountWasBumped(post)) {
      await User.findByIdAndUpdate(post.authorId, { $inc: { postsCount: 1 } });
    }
    const populated = await Post.findById(post._id).populate("authorId", POST_AUTHOR_SELECT).lean();
    const row = populated as Record<string, unknown>;
    return res.json({
      post: {
        ...row,
        author: row.authorId,
        authorId: undefined,
      },
    });
  } catch (err) {
    console.error("adminUsers POST /posts/:postId/restore", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/* ── Admin accounts ──────────────────────────────────────────────────── */

router.get("/admins", requireAdminToken, async (_req: AuthedRequest, res) => {
  try {
    const admins = await Admin.find().select("-passwordHash -__v").sort({ createdAt: 1 }).lean();
    return res.json(admins);
  } catch (err) {
    console.error("adminUsers GET /admins", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/admins/:id", requireAdminToken, async (req: AuthedRequest, res) => {
  try {
    const { isActive, role } = req.body as { isActive?: boolean; role?: string };
    const update: { isActive?: boolean; role?: string } = {};
    if (typeof isActive === "boolean") update.isActive = isActive;
    if (role === "admin" || role === "super_admin") update.role = role;

    const admin = await Admin.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true, select: "-passwordHash -__v" },
    ).lean();
    if (!admin) return res.status(404).json({ message: "Admin not found" });
    return res.json(admin);
  } catch (err) {
    console.error("adminUsers PATCH /admins/:id", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export { router as adminUsersRouter };
