import mongoose, { Schema, type Document, type Types } from "mongoose";

export type PromotionStatus =
  | "draft"
  | "pending_review"
  | "active"
  | "paused"
  | "completed"
  | "rejected";

export type PromotionObjective = "reach" | "followers" | "engagement" | "traffic";
export type PromotionContentType = "post" | "reel" | "story";
export type PromotionPlacement = "feed" | "explore" | "search_top" | "reels" | "stories";

export interface AudienceTarget {
  ageMin?: number;
  ageMax?: number;
  genders?: Array<"male" | "female" | "other">;
  locations?: string[];
  languages?: string[];
  interestTags?: string[];
  placements?: PromotionPlacement[];
}

export interface CtaConfig {
  label: string;
  url: string;
}

export interface PromotionCampaignDoc extends Document {
  ownerUserId: Types.ObjectId;
  contentType: PromotionContentType;
  contentId: Types.ObjectId;
  status: PromotionStatus;
  budgetCoins: number;
  spentCoins: number;
  dailyCapCoins?: number;
  startAt: Date;
  endAt?: Date;
  objective: PromotionObjective;
  audience: AudienceTarget;
  cta?: CtaConfig;
  rejectionReason?: string;
  // Delivery counters
  promotedImpressions: number;
  promotedViews: number;
  organicViews: number;
  profileVisits: number;
  follows: number;
  ctaClicks: number;
  createdAt: Date;
  updatedAt: Date;
}

const audienceSchema = new Schema<AudienceTarget>(
  {
    ageMin: { type: Number },
    ageMax: { type: Number },
    genders: [{ type: String, enum: ["male", "female", "other"] }],
    locations: [{ type: String }],
    languages: [{ type: String }],
    interestTags: [{ type: String }],
    placements: [{ type: String, enum: ["feed", "explore", "search_top", "reels", "stories"] }],
  },
  { _id: false },
);

const ctaSchema = new Schema<CtaConfig>(
  {
    label: { type: String, required: true, maxlength: 30 },
    url: { type: String, required: true },
  },
  { _id: false },
);

const promotionCampaignSchema = new Schema<PromotionCampaignDoc>(
  {
    ownerUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    contentType: { type: String, enum: ["post", "reel", "story"], required: true },
    contentId: { type: Schema.Types.ObjectId, ref: "Post", required: true },
    status: {
      type: String,
      enum: ["draft", "pending_review", "active", "paused", "completed", "rejected"],
      default: "draft",
      index: true,
    },
    budgetCoins: { type: Number, required: true, min: 100 },
    spentCoins: { type: Number, default: 0, min: 0 },
    dailyCapCoins: { type: Number },
    startAt: { type: Date, required: true },
    endAt: { type: Date },
    objective: {
      type: String,
      enum: ["reach", "followers", "engagement", "traffic"],
      required: true,
    },
    audience: { type: audienceSchema, default: () => ({}) },
    cta: { type: ctaSchema },
    rejectionReason: { type: String },
    promotedImpressions: { type: Number, default: 0 },
    promotedViews: { type: Number, default: 0 },
    organicViews: { type: Number, default: 0 },
    profileVisits: { type: Number, default: 0 },
    follows: { type: Number, default: 0 },
    ctaClicks: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Fetch active campaigns for injection into feed/explore
promotionCampaignSchema.index({ status: 1, startAt: 1, endAt: 1 });
// Owner's campaigns list
promotionCampaignSchema.index({ ownerUserId: 1, createdAt: -1 });
// Per-content check: does this post have an active campaign?
promotionCampaignSchema.index({ contentId: 1, status: 1 });

export const PromotionCampaign = mongoose.model<PromotionCampaignDoc>(
  "PromotionCampaign",
  promotionCampaignSchema,
);
