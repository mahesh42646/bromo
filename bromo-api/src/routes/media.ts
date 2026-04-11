import { Router, type Response, type NextFunction } from "express";
import {
  requireFirebaseToken,
  type FirebaseAuthedRequest,
} from "../middleware/firebaseAuth.js";
import { uploadSingle, uploadAvatar } from "../middleware/upload.js";
import { User } from "../models/User.js";

export const mediaRouter = Router();

// POST /media/upload — general file upload (posts, reels, chat media)
mediaRouter.post(
  "/upload",
  requireFirebaseToken,
  (req: FirebaseAuthedRequest, res: Response, next: NextFunction) => {
    uploadSingle(req as Express.Request, res, (err: unknown) => {
      if (err instanceof Error) {
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  },
  (req: FirebaseAuthedRequest, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    const proto = req.headers["x-forwarded-proto"] ?? req.protocol;
    const host = req.get("host") ?? "";
    const url = `${proto}://${host}/uploads/${req.file.filename}`;
    return res.json({ url, filename: req.file.filename });
  },
);

// POST /media/avatar — profile photo upload
mediaRouter.post(
  "/avatar",
  requireFirebaseToken,
  (req: FirebaseAuthedRequest, res: Response, next: NextFunction) => {
    uploadAvatar(req as Express.Request, res, (err: unknown) => {
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
      const proto = req.headers["x-forwarded-proto"] ?? req.protocol;
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
