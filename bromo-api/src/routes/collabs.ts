import { Router, type Response } from "express";
import mongoose from "mongoose";
import {
  requireVerifiedUser,
  type FirebaseAuthedRequest,
} from "../middleware/firebaseAuth.js";
import { Collaboration, type CollaborationDoc } from "../models/Collaboration.js";

export const collabsRouter = Router();

/** GET /collabs/inbox — collaborations where I am the creator */
collabsRouter.get("/inbox", requireVerifiedUser, async (req: FirebaseAuthedRequest, res: Response) => {
  const uid = req.dbUser!._id;
  const rows = await Collaboration.find({ creatorUserId: uid }).sort({ updatedAt: -1 }).limit(100).lean();
  res.json({ items: rows });
});

/** POST /collabs — brand invites creator (admin / brand account only in production; open for now) */
collabsRouter.post("/", requireVerifiedUser, async (req: FirebaseAuthedRequest, res: Response) => {
  const {
    creatorUserId,
    title,
    brief,
    paid,
    payoutCoins,
  } = req.body as {
    creatorUserId?: string;
    title?: string;
    brief?: string;
    paid?: boolean;
    payoutCoins?: number;
  };
  if (!creatorUserId || !mongoose.Types.ObjectId.isValid(creatorUserId) || !title?.trim()) {
    return res.status(400).json({ message: "creatorUserId and title required" });
  }
  const doc = await Collaboration.create({
    brandUserId: req.dbUser!._id,
    creatorUserId: new mongoose.Types.ObjectId(creatorUserId),
    title: title.trim(),
    brief: String(brief ?? "").slice(0, 2000),
    paid: Boolean(paid),
    payoutCoins: typeof payoutCoins === "number" ? payoutCoins : undefined,
    status: "invited",
  });
  res.status(201).json({ collaboration: doc });
});

/** PATCH /collabs/:id — creator accepts / declines */
collabsRouter.patch("/:id", requireVerifiedUser, async (req: FirebaseAuthedRequest, res: Response) => {
  const status = String((req.body as { status?: string }).status ?? "");
  if (!["accepted", "declined", "completed"].includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }
  const c = await Collaboration.findOne({
    _id: req.params.id,
    creatorUserId: req.dbUser!._id,
  });
  if (!c) return res.status(404).json({ message: "Not found" });
  c.status = status as CollaborationDoc["status"];
  await c.save();
  res.json({ collaboration: c });
});
