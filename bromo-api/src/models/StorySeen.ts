import mongoose, { Schema, type Document, type Types } from "mongoose";

export type StoryReaction = "like" | "love" | "haha" | "wow" | "sad" | "fire";

export interface StorySeenDoc extends Document {
  viewerId: Types.ObjectId;
  storyPostId: Types.ObjectId;
  reaction?: StoryReaction;
  reactedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const storySeenSchema = new Schema<StorySeenDoc>(
  {
    viewerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    storyPostId: { type: Schema.Types.ObjectId, ref: "Post", required: true, index: true },
    reaction: { type: String, enum: ["like", "love", "haha", "wow", "sad", "fire"] },
    reactedAt: { type: Date },
  },
  { timestamps: true },
);

storySeenSchema.index({ viewerId: 1, storyPostId: 1 }, { unique: true });

export const StorySeen = mongoose.model<StorySeenDoc>("StorySeen", storySeenSchema);
