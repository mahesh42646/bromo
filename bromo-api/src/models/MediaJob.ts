import mongoose, { Schema, type Document, type Types } from "mongoose";

export type MediaJobStatus = "queued" | "processing" | "ready" | "failed";
export type MediaJobCategory = "posts" | "reels" | "stories" | "profile" | "public";

export interface MediaJobDoc extends Document {
  userId: Types.ObjectId;
  /** Relative path under uploads/ for the raw source file. */
  rawRelPath: string;
  category: MediaJobCategory;
  mediaType: "video" | "image";
  /** Draft post linked to this job (activated when job succeeds). */
  postDraftId?: Types.ObjectId;
  status: MediaJobStatus;
  /** 0–100 progress estimate. */
  progress: number;
  /** Relative path under uploads/hls/<jobId>/ for the master playlist. */
  hlsMasterRelPath?: string;
  /** Relative path for normalized image (if image job). */
  imageRelPath?: string;
  error?: string;
  /** Rendition metadata (height → bitrate mapping). */
  renditions?: Array<{ height: number; bitrate: number }>;
  createdAt: Date;
  updatedAt: Date;
}

const mediaJobSchema = new Schema<MediaJobDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    rawRelPath: { type: String, required: true },
    category: {
      type: String,
      enum: ["posts", "reels", "stories", "profile", "public"],
      required: true,
    },
    mediaType: { type: String, enum: ["video", "image"], required: true },
    postDraftId: { type: Schema.Types.ObjectId, ref: "Post" },
    status: {
      type: String,
      enum: ["queued", "processing", "ready", "failed"],
      default: "queued",
    },
    progress: { type: Number, default: 0 },
    hlsMasterRelPath: { type: String },
    imageRelPath: { type: String },
    error: { type: String },
    renditions: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

mediaJobSchema.index({ userId: 1, status: 1 });
mediaJobSchema.index({ status: 1, createdAt: 1 });

export const MediaJob = mongoose.model<MediaJobDoc>("MediaJob", mediaJobSchema);
