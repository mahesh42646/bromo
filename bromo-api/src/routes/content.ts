import { Router, type Response } from "express";
import { requireFirebaseToken, type FirebaseAuthedRequest } from "../middleware/firebaseAuth.js";

export const contentRouter = Router();

type StickerItem = { id: string; label: string; emoji?: string };

const STICKER_CATALOG: StickerItem[] = [
  { id: "fire", label: "Fire", emoji: "🔥" },
  { id: "love", label: "Love", emoji: "❤️" },
  { id: "wow", label: "Wow", emoji: "✨" },
  { id: "haha", label: "Haha", emoji: "😂" },
  { id: "cool", label: "Cool", emoji: "😎" },
  { id: "star", label: "Star", emoji: "⭐" },
  { id: "goat", label: "GOAT", emoji: "🐐" },
  { id: "shop", label: "Shop", emoji: "🛍️" },
  { id: "clap", label: "Clap", emoji: "👏" },
  { id: "100", label: "100", emoji: "💯" },
];

/** GET /content/stickers — editor sticker palette (extend with DB later) */
contentRouter.get(
  "/stickers",
  requireFirebaseToken,
  (_req: FirebaseAuthedRequest, res: Response) => {
    res.json({ stickers: STICKER_CATALOG });
  },
);
