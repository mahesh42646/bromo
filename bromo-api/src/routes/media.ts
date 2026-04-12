import { Router, type Response, type NextFunction } from "express";
import fs from "node:fs";
import path from "node:path";
import {
  requireFirebaseToken,
  type FirebaseAuthedRequest,
} from "../middleware/firebaseAuth.js";
import { uploadSingle, uploadAvatar } from "../middleware/upload.js";
import { User } from "../models/User.js";
import { generateVideoThumbnail } from "../services/mediaProcessor.js";
import { normalizeMediaAfterUpload } from "../services/videoNormalize.js";
import { rewritePublicMediaUrl } from "../utils/publicMediaUrl.js";
import {
  publicUrlForUploadRelative,
  relativeUploadPathFromAbs,
  normalizeUploadCategory,
} from "../utils/uploadFiles.js";
import { validateUploadForCategory } from "../utils/uploadPolicy.js";

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
      try {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      } catch {
        /* ignore */
      }
      return res.status(400).json({ message: msg });
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

    return res.json({ url, thumbnailUrl, filename: rel, mediaType, converted });
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

      return res.json({ url });
    } catch (err) {
      console.error("[media] avatar upload error:", err);
      return res.status(500).json({ message: "Avatar upload failed" });
    }
  },
);
