import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface MusicTrackDoc extends Document {
  title: string;
  artist: string;
  durationSec: number;
  license: "catalog" | "original";
  previewUrl?: string;
  /** Optional FFmpeg-accessible audio file under `uploads/` (relative path, POSIX). */
  audioRelPath?: string;
  externalId?: string;
  active?: boolean;
}

const musicTrackSchema = new Schema<MusicTrackDoc>(
  {
    title: { type: String, required: true },
    artist: { type: String, required: true },
    durationSec: { type: Number, default: 0 },
    license: { type: String, enum: ["catalog", "original"], default: "catalog" },
    previewUrl: { type: String },
    audioRelPath: { type: String },
    externalId: { type: String, sparse: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

musicTrackSchema.index({ title: "text", artist: "text" });

export const MusicTrack = mongoose.model<MusicTrackDoc>("MusicTrack", musicTrackSchema);
