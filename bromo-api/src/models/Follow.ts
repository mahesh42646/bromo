import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface FollowDoc extends Document {
  followerId: Types.ObjectId;
  followingId: Types.ObjectId;
  status: "pending" | "accepted";
  createdAt: Date;
  updatedAt: Date;
}

const followSchema = new Schema<FollowDoc>(
  {
    followerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    followingId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["pending", "accepted"], default: "accepted" },
  },
  { timestamps: true },
);

followSchema.index({ followerId: 1, followingId: 1 }, { unique: true });
followSchema.index({ followingId: 1, status: 1 });
followSchema.index({ followerId: 1, status: 1 });
followSchema.index({ followerId: 1, status: 1, createdAt: -1 });
followSchema.index({ followingId: 1, status: 1, createdAt: -1 });

export const Follow = mongoose.model<FollowDoc>("Follow", followSchema);
