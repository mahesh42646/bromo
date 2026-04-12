import { Router, type Response, type NextFunction } from "express";
import path from "node:path";
import {
  requireFirebaseToken,
  type FirebaseAuthedRequest,
} from "../middleware/firebaseAuth.js";
import { uploadSingle, uploadAvatar } from "../middleware/upload.js";
import { User } from "../models/User.js";
import { generateVideoThumbnail } from "../services/mediaProcessor.js";

export const mediaRouter = Router();

const VIDEO_EXTS = new Set([".mp4", ".mov", ".m4v", ".3gp", ".webm"]);

function buildUrl(req: FirebaseAuthedRequest, filename: string): string {
  const proto = (Array.isArray(req.headers["x-forwarded-proto"])
    ? req.headers["x-forwarded-proto"][0]
    : req.headers["x-forwarded-proto"]) ?? req.protocol;
  const host = req.get("host") ?? "";
  return `${proto}://${host}/uploads/${filename}`;
}

// POST /media/upload — general file upload (posts, reels, chat media)
mediaRouter.post(
  "/upload",
  requireFirebaseToken,
  (req: FirebaseAuthedRequest, res: Response, next: NextFunction) => {
    uploadSingle(req as never, res, (err: unknown) => {
      if (err instanceof Error) {
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  },
  async (req: FirebaseAuthedRequest, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    const url = buildUrl(req, req.file.filename);
    const ext = path.extname(req.file.filename).toLowerCase();

    // Generate thumbnail for video uploads
    let thumbnailUrl: string | undefined;
    if (VIDEO_EXTS.has(ext)) {
      try {
        const thumbFilename = await generateVideoThumbnail(req.file.filename);
        thumbnailUrl = buildUrl(req, thumbFilename);
      } catch (err) {
        console.error("[media] thumbnail generation failed:", err);
        // Non-fatal — upload still succeeds
      }
    }

    return res.json({url, thumbnailUrl, filename: req.file.filename});
  },
);

// POST /media/avatar — profile photo upload
mediaRouter.post(
  "/avatar",
  requireFirebaseToken,
  (req: FirebaseAuthedRequest, res: Response, next: NextFunction) => {
    uploadAvatar(req as never, res, (err: unknown) => {
      if (err instanceof Error) {
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  },
  async (req: FirebaseAuthedRequest, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    try {
      const proto = (Array.isArray(req.headers["x-forwarded-proto"])
        ? req.headers["x-forwarded-proto"][0]
        : req.headers["x-forwarded-proto"]) ?? req.protocol;
      const host = req.get("host") ?? "";
      const url = `${proto}://${host}/uploads/${req.file.filename}`;

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
