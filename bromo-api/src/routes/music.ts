import { Router, type Response } from "express";
import {
  requireFirebaseToken,
  type FirebaseAuthedRequest,
} from "../middleware/firebaseAuth.js";
import { MusicTrack } from "../models/MusicTrack.js";

export const musicRouter = Router();

function mapTrack(row: {
  _id: unknown;
  title: string;
  artist: string;
  durationSec: number;
  license: string;
}) {
  return {
    id: String(row._id),
    title: row.title,
    artist: row.artist,
    durationSec: row.durationSec ?? 0,
    license: row.license === "original" ? "original" : "catalog",
    source: "catalog",
  };
}

/** GET /music/search?q= */
musicRouter.get(
  "/search",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    const q = String(req.query.q ?? "").trim();
    const rx = q ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : null;
    const filter = rx
      ? {
          active: true,
          $or: [{ title: rx }, { artist: rx }],
        }
      : { active: true };

    const rows = await MusicTrack.find(filter).sort({ title: 1 }).limit(80).lean();

    res.json({
      tracks: rows.map(mapTrack),
    });
  },
);

/** GET /music/trending */
musicRouter.get(
  "/trending",
  requireFirebaseToken,
  async (_req: FirebaseAuthedRequest, res: Response) => {
    const rows = await MusicTrack.find({ active: true }).sort({ createdAt: -1 }).limit(10).lean();
    res.json({
      tracks: rows.map(mapTrack),
    });
  },
);
