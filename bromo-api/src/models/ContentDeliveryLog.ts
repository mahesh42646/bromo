import mongoose, { Schema, type Document, type Types } from "mongoose";

export type DeliverySurface = "feed" | "explore" | "reels" | "story_tray" | "search";
export type BillingCategory = "organic" | "promoted";

export interface ContentDeliveryLogDoc extends Document {
  viewerId: Types.ObjectId;
  contentId: Types.ObjectId;
  contentAuthorId: Types.ObjectId;
  surface: DeliverySurface;
  isFollowerOfAuthor: boolean;
  promotionId?: Types.ObjectId;
  billingCategory: BillingCategory;
  // Billed this impression? (set by billing worker)
  billed: boolean;
  coinsCharged?: number;
  createdAt: Date;
}

const contentDeliveryLogSchema = new Schema<ContentDeliveryLogDoc>(
  {
    viewerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    contentId: { type: Schema.Types.ObjectId, ref: "Post", required: true },
    contentAuthorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    surface: {
      type: String,
      enum: ["feed", "explore", "reels", "story_tray", "search"],
      required: true,
    },
    isFollowerOfAuthor: { type: Boolean, required: true },
    promotionId: { type: Schema.Types.ObjectId, ref: "PromotionCampaign" },
    billingCategory: { type: String, enum: ["organic", "promoted"], required: true },
    billed: { type: Boolean, default: false },
    coinsCharged: { type: Number },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Worker reads unbilled promoted logs
contentDeliveryLogSchema.index({ promotionId: 1, billed: 1, createdAt: 1 });
// Analytics: per-content breakdown
contentDeliveryLogSchema.index({ contentId: 1, billingCategory: 1, createdAt: -1 });
// Prevent viewer flooding
contentDeliveryLogSchema.index({ viewerId: 1, createdAt: -1 });
// Auto-expire after 90 days
contentDeliveryLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const ContentDeliveryLog = mongoose.model<ContentDeliveryLogDoc>(
  "ContentDeliveryLog",
  contentDeliveryLogSchema,
);
