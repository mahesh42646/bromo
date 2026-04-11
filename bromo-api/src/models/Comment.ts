import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface CommentDoc extends Document {
  postId: Types.ObjectId;
  authorId: Types.ObjectId;
  text: string;
  likesCount: number;
  parentId?: Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const commentSchema = new Schema<CommentDoc>(
  {
    postId: { type: Schema.Types.ObjectId, ref: "Post", required: true, index: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, maxlength: 1000 },
    likesCount: { type: Number, default: 0 },
    parentId: { type: Schema.Types.ObjectId, ref: "Comment" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

commentSchema.index({ postId: 1, createdAt: -1 });

export const Comment = mongoose.model<CommentDoc>("Comment", commentSchema);
