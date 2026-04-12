import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface PostDoc extends Document {
  authorId: Types.ObjectId;
  type: "post" | "reel" | "story";
  mediaUrl: string;
  mediaType: "image" | "video";
  thumbnailUrl: string;
  caption: string;
  location: string;
  tags: string[];
  music: string;
  likesCount: number;
  commentsCount: number;
  viewsCount: number;
  expiresAt?: Date;
  isActive: boolean;
  /** Soft-removed from feeds; files may remain on disk until hard delete. */
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const postSchema = new Schema<PostDoc>(
  {
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["post", "reel", "story"], required: true },
    mediaUrl: { type: String, required: true },
    mediaType: { type: String, enum: ["image", "video"], required: true },
    thumbnailUrl: { type: String, default: "" },
    caption: { type: String, default: "", maxlength: 2200 },
    location: { type: String, default: "" },
    tags: [{ type: String }],
    music: { type: String, default: "" },
    likesCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
    viewsCount: { type: Number, default: 0 },
    expiresAt: { type: Date },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

postSchema.index({ authorId: 1, createdAt: -1 });
postSchema.index({ type: 1, createdAt: -1 });
postSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Post = mongoose.model<PostDoc>("Post", postSchema);
