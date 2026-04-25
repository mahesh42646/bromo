import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface PostPollVoteDoc extends Document {
  postId: Types.ObjectId;
  userId: Types.ObjectId;
  optionIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

const postPollVoteSchema = new Schema<PostPollVoteDoc>(
  {
    postId: { type: Schema.Types.ObjectId, ref: "Post", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    optionIndex: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);

postPollVoteSchema.index({ postId: 1, userId: 1 }, { unique: true });

export const PostPollVote = mongoose.model<PostPollVoteDoc>("PostPollVote", postPollVoteSchema);
