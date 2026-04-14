import mongoose, { Schema, type Document, type Types } from "mongoose";

export type AdEventType = "impression" | "click" | "video_view" | "video_complete";
export type AdPlacement = "feed" | "reels" | "stories" | "explore";

export interface AdEventDoc extends Document {
  adId: Types.ObjectId;
  userId?: Types.ObjectId;
  event: AdEventType;
  placement: AdPlacement;
  watchTimeMs?: number;
  createdAt: Date;
}

const adEventSchema = new Schema<AdEventDoc>(
  {
    adId: { type: Schema.Types.ObjectId, ref: "Ad", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    event: {
      type: String,
      enum: ["impression", "click", "video_view", "video_complete"],
      required: true,
    },
    placement: {
      type: String,
      enum: ["feed", "reels", "stories", "explore"],
      required: true,
    },
    watchTimeMs: { type: Number },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

// Analytics aggregation: group by adId + event + date
adEventSchema.index({ adId: 1, event: 1, createdAt: -1 });
// By-placement breakdown
adEventSchema.index({ adId: 1, placement: 1, createdAt: -1 });
// Auto-expire events after 90 days
adEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const AdEvent = mongoose.model<AdEventDoc>("AdEvent", adEventSchema);
