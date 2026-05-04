import { Router, type Response } from "express";
import {
  requireFirebaseToken,
  type FirebaseAuthedRequest,
} from "../middleware/firebaseAuth.js";

export const musicRouter = Router();

type CatalogRow = { id: string; title: string; artist: string; durationSec: number; license: string };

/** Keep in sync with `src/data/musicCatalog.json` (seed / docs). */
const BUILTIN_CATALOG: CatalogRow[] = [
  { id: "cat_1", title: "Studio Pulse", artist: "Bromo Sound", durationSec: 180, license: "catalog" },
  { id: "cat_2", title: "Night Drive", artist: "Bromo Sound", durationSec: 210, license: "catalog" },
  { id: "cat_3", title: "Morning Lift", artist: "Bromo Sound", durationSec: 195, license: "catalog" },
];

function loadCatalog(): CatalogRow[] {
  return BUILTIN_CATALOG;
}

/** GET /music/search?q= */
musicRouter.get(
  "/search",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    const q = String(req.query.q ?? "").trim().toLowerCase();
    const rows = loadCatalog().filter(
      (r) =>
        !q ||
        r.title.toLowerCase().includes(q) ||
        r.artist.toLowerCase().includes(q),
    );
    res.json({
      tracks: rows.map((r) => ({
        id: r.id,
        title: r.title,
        artist: r.artist,
        durationSec: r.durationSec,
        license: r.license,
        source: "catalog",
      })),
    });
  },
);

/** GET /music/trending */
musicRouter.get(
  "/trending",
  requireFirebaseToken,
  async (_req: FirebaseAuthedRequest, res: Response) => {
    const rows = loadCatalog().slice(0, 10);
    res.json({
      tracks: rows.map((r) => ({
        id: r.id,
        title: r.title,
        artist: r.artist,
        durationSec: r.durationSec,
        license: r.license,
        source: "catalog",
      })),
    });
  },
);
