import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface LikeDoc extends Document {
  targetId: Types.ObjectId;
  targetType: "post" | "comment";
  userId: Types.ObjectId;
  createdAt: Date;
}

const likeSchema = new Schema<LikeDoc>(
  {
    targetId: { type: Schema.Types.ObjectId, required: true },
    targetType: { type: String, enum: ["post", "comment"], required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

likeSchema.index({ targetId: 1, userId: 1, targetType: 1 }, { unique: true });
likeSchema.index({ userId: 1, targetType: 1 });

export const Like = mongoose.model<LikeDoc>("Like", likeSchema);
