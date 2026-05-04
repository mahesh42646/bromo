/**
 * One-shot: upsert MusicTrack rows from src/data/musicCatalog.json
 * Run: pnpm exec tsx src/scripts/seedMusicCatalog.ts (from bromo-api)
 */

import mongoose from "mongoose";
import fs from "node:fs";
import path from "node:path";
import { MusicTrack } from "../models/MusicTrack.js";

type Row = {
  id: string;
  title: string;
  artist: string;
  durationSec: number;
  license: "catalog" | "original";
  audioRelPath?: string;
};

async function main(): Promise<void> {
  const mongoUri = process.env.MONGO_URI ?? process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("Set MONGO_URI or MONGODB_URI");
    process.exit(1);
  }
  await mongoose.connect(mongoUri);

  const jsonPath = path.join(process.cwd(), "src/data/musicCatalog.json");
  const raw = fs.readFileSync(jsonPath, "utf8");
  const rows = JSON.parse(raw) as Row[];

  for (const r of rows) {
    await MusicTrack.findOneAndUpdate(
      { externalId: r.id },
      {
        title: r.title,
        artist: r.artist,
        durationSec: r.durationSec,
        license: r.license === "original" ? "original" : "catalog",
        externalId: r.id,
        active: true,
        ...(r.audioRelPath?.trim() ? { audioRelPath: r.audioRelPath.trim() } : {}),
      },
      { upsert: true, new: true },
    );
  }

  console.info(`[seedMusicCatalog] upserted ${rows.length} tracks`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
