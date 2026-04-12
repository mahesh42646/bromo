import { Router, type Response, type NextFunction } from "express";
import path from "node:path";
import {
  requireFirebaseToken,
  type FirebaseAuthedRequest,
} from "../middleware/firebaseAuth.js";
import { uploadSingle, uploadAvatar } from "../middleware/upload.js";
import { User } from "../models/User.js";
import { generateVideoThumbnail } from "../services/mediaProcessor.js";
import { rewritePublicMediaUrl } from "../utils/publicMediaUrl.js";
import {
  publicUrlForUploadRelative,
  relativeUploadPathFromAbs,
} from "../utils/uploadFiles.js";

export const mediaRouter = Router();

const VIDEO_EXTS = new Set([".mp4", ".mov", ".m4v", ".3gp", ".webm"]);

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
    const rel = relativeUploadPathFromAbs(req.file.path);
    const url = urlFromStoredOrRelative(rel);
    const ext = path.extname(req.file.filename).toLowerCase();

    let thumbnailUrl: string | undefined;
    if (VIDEO_EXTS.has(ext)) {
      try {
        const thumbRel = await generateVideoThumbnail(rel);
        thumbnailUrl = urlFromStoredOrRelative(thumbRel);
      } catch (err) {
        console.error("[media] thumbnail generation failed:", err);
      }
    }

    return res.json({ url, thumbnailUrl, filename: rel });
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
