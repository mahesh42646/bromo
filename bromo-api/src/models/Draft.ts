import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface DraftDoc extends Document {
  userId: Types.ObjectId;
  type: "post" | "reel" | "story";
  /** Local content URI (device-only) OR uploaded preview URL */
  localUri: string;
  thumbnailUri: string;
  mediaType: "image" | "video";
  caption: string;
  location: string;
  locationMeta?: { name: string; lat: number; lng: number };
  tags: string[];
  taggedUserIds: Types.ObjectId[];
  productIds: Types.ObjectId[];
  music: string;
  feedCategory: string;
  filters?: Record<string, unknown>;
  trim?: { startMs: number; endMs: number };
  settings?: {
    commentsOff?: boolean;
    hideLikes?: boolean;
    allowRemix?: boolean;
    closeFriendsOnly?: boolean;
  };
  durationMs?: number;
  createdAt: Date;
  updatedAt: Date;
}

const draftSchema = new Schema<DraftDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["post", "reel", "story"], required: true },
    localUri: { type: String, default: "" },
    thumbnailUri: { type: String, default: "" },
    mediaType: { type: String, enum: ["image", "video"], required: true },
    caption: { type: String, default: "", maxlength: 2200 },
    location: { type: String, default: "" },
    locationMeta: {
      name: String,
      lat: Number,
      lng: Number,
    },
    tags: [{ type: String }],
    taggedUserIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    productIds: [{ type: Schema.Types.ObjectId, ref: "AffiliateProduct" }],
    music: { type: String, default: "" },
    feedCategory: { type: String, default: "general" },
    filters: { type: Schema.Types.Mixed, default: undefined },
    trim: {
      startMs: Number,
      endMs: Number,
    },
    settings: {
      commentsOff: Boolean,
      hideLikes: Boolean,
      allowRemix: Boolean,
      closeFriendsOnly: Boolean,
    },
    durationMs: { type: Number },
  },
  { timestamps: true },
);

draftSchema.index({ userId: 1, updatedAt: -1 });

export const Draft = mongoose.model<DraftDoc>("Draft", draftSchema);
