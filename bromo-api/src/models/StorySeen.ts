import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface StorySeenDoc extends Document {
  viewerId: Types.ObjectId;
  storyPostId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const storySeenSchema = new Schema<StorySeenDoc>(
  {
    viewerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    storyPostId: { type: Schema.Types.ObjectId, ref: "Post", required: true, index: true },
  },
  { timestamps: true },
);

storySeenSchema.index({ viewerId: 1, storyPostId: 1 }, { unique: true });

export const StorySeen = mongoose.model<StorySeenDoc>("StorySeen", storySeenSchema);
