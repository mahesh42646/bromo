import { Router, type Response, type NextFunction } from "express";
import fs from "node:fs";
import path from "node:path";
import {
  requireFirebaseToken,
  type FirebaseAuthedRequest,
} from "../middleware/firebaseAuth.js";
import { uploadSingle, uploadAvatar } from "../middleware/upload.js";
import { User } from "../models/User.js";
import { MediaJob } from "../models/MediaJob.js";
import { Post } from "../models/Post.js";
import { generateVideoThumbnail } from "../services/mediaProcessor.js";
import { normalizeMediaAfterUpload } from "../services/videoNormalize.js";
import { normalizeImage } from "../services/imageNormalize.js";
import { rewritePublicMediaUrl } from "../utils/publicMediaUrl.js";
import {
  publicUrlForUploadRelative,
  relativeUploadPathFromAbs,
  normalizeUploadCategory,
  uploadRelativePathFromUrl,
} from "../utils/uploadFiles.js";
import { mirrorUploadRelative } from "../services/s3Mirror.js";
import {
  validateUploadForCategory,
  isVideoLike,
  extFromOriginalName,
} from "../utils/uploadPolicy.js";
import { enqueueMediaJob } from "../workers/mediaWorker.js";
import { normalizeFeedCategory } from "../utils/feedCategory.js";

export const mediaRouter = Router();

const VIDEO_EXTS = new Set([".mp4", ".mov", ".m4v", ".3gp", ".webm", ".mkv", ".avi", ".mpeg", ".mpg"]);

function urlFromStoredOrRelative(stored: string): string {
  if (stored.startsWith("http")) return rewritePublicMediaUrl(stored);
  return publicUrlForUploadRelative(stored.replace(/^\/+/, ""));
}

function requireDbUser(req: FirebaseAuthedRequest, res: Response, next: NextFunction) {
  if (!req.dbUser) {
    return res.status(401).json({ message: "Register to upload media" });
  }
  return next();
}

// POST /media/upload — general file upload (posts, reels, chat media)
mediaRouter.post(
  "/upload",
  requireFirebaseToken,
  requireDbUser,
  (req: FirebaseAuthedRequest, res: Response, next: NextFunction) => {
    uploadSingle(req as never, res, (err: unknown) => {
      if (err instanceof Error) {
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  },
  async (req: FirebaseAuthedRequest, res: Response) => {
    if (!req.file?.path) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    const cat = normalizeUploadCategory((req.query as { category?: string }).category);
    const policyErr = validateUploadForCategory(cat, req.file.mimetype, req.file.originalname);
    if (policyErr) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        /* ignore */
      }
      console.warn("[media] upload rejected after store:", policyErr, req.file.path);
      return res.status(400).json({ message: policyErr });
    }
    let rel = relativeUploadPathFromAbs(req.file.path);
    console.info("[media] upload stored", cat, rel, req.file.mimetype);

    let mediaType: "video" | "image" = "image";
    let converted = false;
    try {
      const norm = await normalizeMediaAfterUpload(rel, cat);
      rel = norm.rel;
      mediaType = norm.mediaType;
      converted = norm.converted;
      if (converted) {
        console.info("[media] normalized to mp4", rel);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Media processing failed";
      console.warn("[media] normalize failed:", msg);
      // Fail-open for user uploads: keep original video when optimization fails.
      const origExt = extFromOriginalName(req.file.originalname || "");
      const isHeic = origExt === ".heic" || origExt === ".heif";
      // HEIC files: iOS sends video/quicktime MIME — never treat as video
      const isVideoUpload = !isHeic && isVideoLike(req.file.mimetype, origExt);
      if (isVideoUpload) {
        mediaType = "video";
        converted = false;
      } else {
        try {
          if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        } catch {
          /* ignore */
        }
        return res.status(400).json({ message: msg });
      }
    }

    if (mediaType === "image") {
      try {
        const prev = rel;
        rel = await normalizeImage(rel);
        if (rel !== prev) converted = true;
      } catch (e) {
        console.warn("[media] WebP normalize failed:", e);
      }
    }

    const url = urlFromStoredOrRelative(rel);
    const ext = path.extname(rel).toLowerCase();

    let thumbnailUrl: string | undefined;
    if (mediaType === "video" || VIDEO_EXTS.has(ext)) {
      try {
        const thumbRel = await generateVideoThumbnail(rel);
        thumbnailUrl = urlFromStoredOrRelative(thumbRel);
      } catch (err) {
        console.error("[media] thumbnail generation failed:", err);
      }
    }

    void mirrorUploadRelative(rel).catch(() => null);
    if (thumbnailUrl) {
      const tr = uploadRelativePathFromUrl(thumbnailUrl);
      if (tr) void mirrorUploadRelative(tr).catch(() => null);
    }

    return res.json({ url, thumbnailUrl, filename: rel, mediaType, converted });
  },
);

/**
 * POST /media/upload-async
 * Accepts any media file, stores to disk, creates a MediaJob + draft Post,
 * enqueues background HLS transcode (video) or image normalize (image).
 * Returns immediately with { jobId, postId } — client polls /media/jobs/:id.
 *
 * Query params:
 *   category: posts | reels | stories (default: posts)
 *   caption, location, music, tags (optional — applied to draft post)
 */
mediaRouter.post(
  "/upload-async",
  requireFirebaseToken,
  requireDbUser,
  (req: FirebaseAuthedRequest, res: Response, next: NextFunction) => {
    uploadSingle(req as never, res, (err: unknown) => {
      if (err instanceof Error) return res.status(400).json({ message: err.message });
      next();
    });
  },
  async (req: FirebaseAuthedRequest, res: Response) => {
    if (!req.file?.path) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    const dbUser = req.dbUser!;
    const cat = normalizeUploadCategory((req.query as Record<string, string>).category);

    const policyErr = validateUploadForCategory(cat, req.file.mimetype, req.file.originalname);
    if (policyErr) {
      try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
      return res.status(400).json({ message: policyErr });
    }

    const rel = relativeUploadPathFromAbs(req.file.path);
    // Detect HEIC/HEIF by extension first — iOS sends them as video/quicktime which would
    // incorrectly classify them as video. They must always be routed to image processing.
    const uploadExt = (path.extname(req.file.originalname || "").toLowerCase() || path.extname(req.file.path).toLowerCase());
    const isHeicUpload = uploadExt === ".heic" || uploadExt === ".heif";
    const mediaType: "video" | "image" = !isHeicUpload && isVideoLike(req.file.mimetype, extFromOriginalName(req.file.originalname ?? ""))
      ? "video"
      : "image";

    // Map category to post type
    const postType = cat === "reels" ? "reel" : cat === "stories" ? "story" : "post";

    // Parse optional metadata from body
    const body = req.body as Record<string, string | undefined>;
    const caption = body.caption ?? "";
    const location = body.location ?? "";
    const music = body.music ?? "";
    const tags: string[] = body.tags ? String(body.tags).split(",").map((t) => t.trim()).filter(Boolean) : [];

    const parseIds = (raw?: string): string[] =>
      raw
        ? String(raw)
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s && /^[a-f0-9]{24}$/i.test(s))
        : [];

    const taggedUserIdStrs = parseIds(body.taggedUserIds);
    const productIdStrs = parseIds(body.productIds).slice(0, 6);
    const collaboratorIdStrs = parseIds(body.collaboratorIds).slice(0, 5);

    let locationMeta: { name: string; lat?: number; lng?: number; address?: string; placeId?: string } | undefined;
    if (body.locationMeta) {
      try {
        const m = JSON.parse(body.locationMeta) as Record<string, unknown>;
        if (m && typeof m.name === "string") {
          locationMeta = {
            name: m.name,
            lat: typeof m.lat === "number" ? m.lat : undefined,
            lng: typeof m.lng === "number" ? m.lng : undefined,
            address: typeof m.address === "string" ? m.address : undefined,
            placeId: typeof m.placeId === "string" ? m.placeId : undefined,
          };
        }
      } catch { /* ignore */ }
    }

    let settings: { commentsOff?: boolean; hideLikes?: boolean; allowRemix?: boolean; closeFriendsOnly?: boolean } | undefined;
    if (body.settings) {
      try {
        const s = JSON.parse(body.settings) as Record<string, unknown>;
        settings = {
          commentsOff: Boolean(s.commentsOff),
          hideLikes: Boolean(s.hideLikes),
          allowRemix: s.allowRemix === undefined ? true : Boolean(s.allowRemix),
          closeFriendsOnly: Boolean(s.closeFriendsOnly),
        };
      } catch { /* ignore */ }
    }

    const durationMs = body.durationMs != null && !isNaN(Number(body.durationMs))
      ? Number(body.durationMs)
      : undefined;

    const scheduledForRaw = typeof body.scheduledFor === "string" ? body.scheduledFor.trim() : "";
    const scheduledFor = scheduledForRaw ? new Date(scheduledForRaw) : undefined;
    const isScheduled =
      scheduledFor instanceof Date &&
      !Number.isNaN(scheduledFor.getTime()) &&
      scheduledFor.getTime() > Date.now();

    let clientEditMeta: Record<string, unknown> | undefined;
    if (body.clientEditMeta && typeof body.clientEditMeta === "string") {
      try {
        const parsed = JSON.parse(body.clientEditMeta) as unknown;
        if (parsed && typeof parsed === "object") {
          clientEditMeta = parsed as Record<string, unknown>;
        }
      } catch {
        /* ignore */
      }
    }

    let storyMeta: Record<string, unknown> | undefined;
    if (body.storyMeta && typeof body.storyMeta === "string") {
      try {
        const parsed = JSON.parse(body.storyMeta) as unknown;
        if (parsed && typeof parsed === "object") {
          storyMeta = parsed as Record<string, unknown>;
        }
      } catch {
        /* ignore */
      }
    }

    // Thumbnail for immediate preview (sync, lightweight)
    let thumbnailUrl = "";
    if (mediaType === "video") {
      try {
        const thumbRel = await generateVideoThumbnail(rel);
        thumbnailUrl = urlFromStoredOrRelative(thumbRel);
      } catch { /* non-fatal */ }
    }

    const storyExpiresAt =
      postType === "story" && !isScheduled
        ? new Date(Date.now() + 24 * 60 * 60 * 1000)
        : undefined;
    const feedCategory =
      postType === "story" ? "general" : normalizeFeedCategory(body.feedCategory);

    // Create draft post — hidden until processingStatus === ready
    const mongooseRef = (await import("mongoose")).default;
    const safeTaggedUserIds = taggedUserIdStrs
      .slice(0, 20)
      .map((x) => new mongooseRef.Types.ObjectId(x));
    const safeProductIds = productIdStrs.map((x) => new mongooseRef.Types.ObjectId(x));
    const safeCollaboratorIds = collaboratorIdStrs
      .filter((x) => String(x) !== String(dbUser._id))
      .map((x) => new mongooseRef.Types.ObjectId(x));
    if (safeProductIds.length && !(dbUser.isCreator && dbUser.creatorStatus === "verified")) {
      return res.status(403).json({ message: "Only verified creators can tag products" });
    }
    const originalAudioId =
      body.originalAudioId && mongooseRef.Types.ObjectId.isValid(body.originalAudioId)
        ? new mongooseRef.Types.ObjectId(body.originalAudioId)
        : undefined;
    const remixOfPostId =
      body.remixOfPostId && mongooseRef.Types.ObjectId.isValid(body.remixOfPostId)
        ? new mongooseRef.Types.ObjectId(body.remixOfPostId)
        : undefined;
    const musicTrackId =
      body.musicTrackId && mongooseRef.Types.ObjectId.isValid(body.musicTrackId)
        ? new mongooseRef.Types.ObjectId(body.musicTrackId)
        : undefined;

    const draftPost = await Post.create({
      authorId: dbUser._id,
      type: postType,
      mediaUrl: publicUrlForUploadRelative(rel), // raw URL as fallback / placeholder
      mediaType,
      thumbnailUrl,
      caption,
      location,
      ...(locationMeta ? { locationMeta } : {}),
      music,
      tags,
      ...(safeTaggedUserIds.length ? { taggedUserIds: safeTaggedUserIds } : {}),
      ...(safeProductIds.length ? { productIds: safeProductIds } : {}),
      ...(safeCollaboratorIds.length ? { collaboratorIds: safeCollaboratorIds } : {}),
      ...(originalAudioId ? { originalAudioId } : {}),
      ...(remixOfPostId ? { remixOfPostId } : {}),
      ...(musicTrackId ? { musicTrackId } : {}),
      ...(settings ? { settings } : {}),
      ...(typeof durationMs === "number" ? { durationMs } : {}),
      ...(clientEditMeta ? { clientEditMeta } : {}),
      ...(postType === "story" && storyMeta ? { storyMeta } : {}),
      ...(isScheduled ? { scheduledFor } : {}),
      feedCategory,
      expiresAt: storyExpiresAt,
      processingStatus: "pending",
      isActive: false, // hidden from feeds until HLS ready
    });

    // Create job record
    const job = await MediaJob.create({
      userId: dbUser._id,
      rawRelPath: rel,
      category: cat,
      mediaType,
      postDraftId: draftPost._id,
      status: "queued",
    });

    // Link job to post
    await Post.updateOne({ _id: draftPost._id }, { mediaJobId: job._id });

    // Kick off background worker
    enqueueMediaJob(String(job._id));

    console.info(`[media] async job queued: ${job._id} (${cat}, ${mediaType})`);

    return res.status(202).json({
      jobId: String(job._id),
      postId: String(draftPost._id),
      thumbnailUrl: thumbnailUrl || undefined,
      message: "Processing started",
    });
  },
);

// POST /media/avatar — profile photo upload
mediaRouter.post(
  "/avatar",
  requireFirebaseToken,
  requireDbUser,
  (req: FirebaseAuthedRequest, res: Response, next: NextFunction) => {
    uploadAvatar(req as never, res, (err: unknown) => {
      if (err instanceof Error) {
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  },
  async (req: FirebaseAuthedRequest, res: Response) => {
    if (!req.file?.path) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    const avatarPolicy = validateUploadForCategory("profile", req.file.mimetype, req.file.originalname);
    if (avatarPolicy) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        /* ignore */
      }
      return res.status(400).json({ message: avatarPolicy });
    }
    try {
      const rel = relativeUploadPathFromAbs(req.file.path);
      const url = urlFromStoredOrRelative(rel);

      if (req.dbUser) {
        req.dbUser.profilePicture = url;
        await req.dbUser.save();
      }

      void mirrorUploadRelative(rel).catch(() => null);

      return res.json({ url });
    } catch (err) {
      console.error("[media] avatar upload error:", err);
      return res.status(500).json({ message: "Avatar upload failed" });
    }
  },
);
