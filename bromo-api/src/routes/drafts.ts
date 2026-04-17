import { Router, type Response } from "express";
import mongoose from "mongoose";
import { Draft } from "../models/Draft.js";
import {
  requireFirebaseToken,
  requireVerifiedUser,
  type FirebaseAuthedRequest,
} from "../middleware/firebaseAuth.js";

export const draftsRouter = Router();

draftsRouter.get(
  "/",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const user = req.dbUser;
      if (!user) return res.json({ drafts: [] });
      const drafts = await Draft.find({ userId: user._id })
        .sort({ updatedAt: -1 })
        .limit(100)
        .lean();
      return res.json({ drafts });
    } catch (err) {
      console.error("[drafts] list:", err);
      return res.status(500).json({ message: "Failed to list drafts" });
    }
  },
);

draftsRouter.post(
  "/",
  requireVerifiedUser,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const user = req.dbUser!;
      const b = req.body as Record<string, unknown>;
      const doc = await Draft.create({
        userId: user._id,
        type: (b.type as "post" | "reel" | "story") ?? "reel",
        localUri: String(b.localUri ?? ""),
        thumbnailUri: String(b.thumbnailUri ?? ""),
        mediaType: (b.mediaType as "image" | "video") ?? "video",
        caption: String(b.caption ?? "").slice(0, 2200),
        location: String(b.location ?? ""),
        locationMeta: b.locationMeta as DraftLocation | undefined,
        tags: Array.isArray(b.tags) ? (b.tags as string[]).slice(0, 30) : [],
        taggedUserIds: Array.isArray(b.taggedUserIds)
          ? (b.taggedUserIds as string[])
              .filter((x) => mongoose.Types.ObjectId.isValid(x))
              .map((x) => new mongoose.Types.ObjectId(x))
          : [],
        productIds: Array.isArray(b.productIds)
          ? (b.productIds as string[])
              .filter((x) => mongoose.Types.ObjectId.isValid(x))
              .slice(0, 6)
              .map((x) => new mongoose.Types.ObjectId(x))
          : [],
        music: String(b.music ?? ""),
        feedCategory: String(b.feedCategory ?? "general"),
        filters: b.filters as Record<string, unknown> | undefined,
        trim: b.trim as { startMs: number; endMs: number } | undefined,
        settings: b.settings as DraftSettings | undefined,
        durationMs: typeof b.durationMs === "number" ? b.durationMs : undefined,
      });
      return res.status(201).json({ draft: doc });
    } catch (err) {
      console.error("[drafts] create:", err);
      return res.status(500).json({ message: "Failed to save draft" });
    }
  },
);

draftsRouter.patch(
  "/:id",
  requireVerifiedUser,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const user = req.dbUser!;
      const b = req.body as Record<string, unknown>;
      const allowed = [
        "localUri",
        "thumbnailUri",
        "caption",
        "location",
        "locationMeta",
        "tags",
        "taggedUserIds",
        "productIds",
        "music",
        "feedCategory",
        "filters",
        "trim",
        "settings",
        "durationMs",
      ] as const;
      const update: Record<string, unknown> = {};
      for (const k of allowed) if (k in b) update[k] = b[k];
      const doc = await Draft.findOneAndUpdate(
        { _id: req.params.id, userId: user._id },
        { $set: update },
        { new: true },
      );
      if (!doc) return res.status(404).json({ message: "Draft not found" });
      return res.json({ draft: doc });
    } catch (err) {
      console.error("[drafts] update:", err);
      return res.status(500).json({ message: "Failed to update draft" });
    }
  },
);

draftsRouter.delete(
  "/:id",
  requireVerifiedUser,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const user = req.dbUser!;
      const doc = await Draft.findOneAndDelete({ _id: req.params.id, userId: user._id });
      if (!doc) return res.status(404).json({ message: "Draft not found" });
      return res.json({ success: true });
    } catch (err) {
      console.error("[drafts] delete:", err);
      return res.status(500).json({ message: "Failed to delete draft" });
    }
  },
);

type DraftLocation = { name: string; lat: number; lng: number };
type DraftSettings = {
  commentsOff?: boolean;
  hideLikes?: boolean;
  allowRemix?: boolean;
  closeFriendsOnly?: boolean;
};
