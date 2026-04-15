import mongoose, { Schema, type Document, type Types } from "mongoose";

export type AdStatus = "draft" | "active" | "paused" | "archived";
export type AdType = "image" | "carousel" | "video";
export type AdPlacement = "feed" | "reels" | "stories" | "explore";
export type AdActionType = "external_url" | "in_app";

export interface AdCta {
  label: string;
  actionType: AdActionType;
  externalUrl?: string;
  inAppScreen?: string;
  inAppParams?: Record<string, unknown>;
}

export interface AdDoc extends Document {
  title: string;
  status: AdStatus;
  adType: AdType;
  mediaUrls: string[];
  thumbnailUrl: string;
  caption: string;
  brandName?: string;
  cta: AdCta;
  placements: AdPlacement[];
  startDate: Date;
  endDate?: Date;
  priority: number;
  totalImpressions: number;
  totalClicks: number;
  totalVideoViews: number;
  totalVideoCompletions: number;
  totalWatchTimeMs: number;
  likesCount: number;
  sharesCount: number;
  savesCount: number;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ctaSchema = new Schema<AdCta>(
  {
    label: { type: String, required: true, maxlength: 30 },
    actionType: { type: String, enum: ["external_url", "in_app"], required: true },
    externalUrl: { type: String },
    inAppScreen: { type: String },
    inAppParams: { type: Schema.Types.Mixed },
  },
  { _id: false },
);

const adSchema = new Schema<AdDoc>(
  {
    title: { type: String, required: true, maxlength: 200 },
    status: {
      type: String,
      enum: ["draft", "active", "paused", "archived"],
      default: "draft",
      index: true,
    },
    adType: { type: String, enum: ["image", "carousel", "video"], required: true },
    mediaUrls: { type: [String], required: true, validate: (v: string[]) => v.length >= 1 && v.length <= 10 },
    thumbnailUrl: { type: String, default: "" },
    caption: { type: String, default: "", maxlength: 2200 },
    cta: { type: ctaSchema, required: true },
    placements: {
      type: [{ type: String, enum: ["feed", "reels", "stories", "explore"] }],
      required: true,
      validate: (v: string[]) => v.length >= 1,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    priority: { type: Number, default: 1, min: 1, max: 10 },
    totalImpressions: { type: Number, default: 0 },
    totalClicks: { type: Number, default: 0 },
    totalVideoViews: { type: Number, default: 0 },
    totalVideoCompletions: { type: Number, default: 0 },
    totalWatchTimeMs: { type: Number, default: 0 },
    likesCount: { type: Number, default: 0 },
    sharesCount: { type: Number, default: 0 },
    savesCount: { type: Number, default: 0 },
    brandName: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
  },
  { timestamps: true },
);

// Efficient serve query: active ads for a placement that are currently scheduled
adSchema.index({ status: 1, placements: 1, startDate: 1, endDate: 1 });
adSchema.index({ status: 1, priority: -1, createdAt: -1 });

export const Ad = mongoose.model<AdDoc>("Ad", adSchema);
