import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface AdEngagementDoc extends Document {
  adId: Types.ObjectId;
  userId: Types.ObjectId;
  likedAt?: Date;
  savedAt?: Date;
  sharedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const adEngagementSchema = new Schema<AdEngagementDoc>(
  {
    adId: { type: Schema.Types.ObjectId, ref: "Ad", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    likedAt: { type: Date },
    savedAt: { type: Date },
    sharedAt: { type: Date },
  },
  { timestamps: true },
);

// One document per (ad, user) pair — upserted on like/save/share
adEngagementSchema.index({ adId: 1, userId: 1 }, { unique: true });
// For querying a user's saved ads
adEngagementSchema.index({ userId: 1, savedAt: 1 });
// For querying a user's liked ads
adEngagementSchema.index({ userId: 1, likedAt: 1 });

export const AdEngagement = mongoose.model<AdEngagementDoc>("AdEngagement", adEngagementSchema);
