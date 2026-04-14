import mongoose, { Schema, type Document, type Types } from "mongoose";

export type StoryOverlay = {
  id: string;
  type: "text" | "emoji" | "music";
  content: string;
  /** 0–1 relative to screen width */
  x: number;
  /** 0–1 relative to screen height */
  y: number;
  color?: string;
  fontSize?: number;
};

export type StoryMeta = {
  /** Solid/gradient background hex for color-background stories */
  bgColor?: string;
  /** Text, emoji, and music badge overlays */
  overlays?: StoryOverlay[];
};

export type ProcessingStatus = "pending" | "processing" | "ready" | "failed";

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
  /** Unique accounts who saw the post (impressions = raw events including repeats) */
  impressionsCount: number;
  sharesCount: number;
  totalWatchTimeMs: number;
  /** milliseconds — recomputed on each view update */
  avgWatchTimeMs: number;
  /** Decaying score: higher = trending. Recomputed on like/comment/view. */
  trendingScore: number;
  expiresAt?: Date;
  isActive: boolean;
  /** Soft-removed from feeds; files may remain on disk until hard delete. */
  isDeleted: boolean;
  deletedAt?: Date;
  /** Story-only: background color + draggable overlays */
  storyMeta?: StoryMeta;
  /** HLS master playlist URL (served from /uploads/hls/<jobId>/master.m3u8). Preferred over mediaUrl for video. */
  hlsMasterUrl?: string;
  /** Processing pipeline status. Posts stay hidden until 'ready'. */
  processingStatus?: ProcessingStatus;
  /** Error detail when processingStatus === 'failed'. */
  processingError?: string;
  /** Reference to the MediaJob driving this post's transcode. */
  mediaJobId?: Types.ObjectId;
  /** Home / explore bucket (post + reel). Default general. */
  feedCategory: string;
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
    impressionsCount: { type: Number, default: 0 },
    sharesCount: { type: Number, default: 0 },
    totalWatchTimeMs: { type: Number, default: 0 },
    avgWatchTimeMs: { type: Number, default: 0 },
    trendingScore: { type: Number, default: 0 },
    expiresAt: { type: Date },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
    storyMeta: { type: Schema.Types.Mixed, default: undefined },
    hlsMasterUrl: { type: String },
    processingStatus: {
      type: String,
      enum: ["pending", "processing", "ready", "failed"],
      default: undefined,
    },
    processingError: { type: String },
    mediaJobId: { type: Schema.Types.ObjectId, ref: "MediaJob" },
    feedCategory: { type: String, default: "general", index: true },
  },
  { timestamps: true },
);

postSchema.index({ authorId: 1, createdAt: -1 });
postSchema.index({ type: 1, createdAt: -1 });
postSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// Fast feed/reels lookup — covers the query filter + _id sort in one index scan
postSchema.index({ type: 1, isActive: 1, isDeleted: 1, _id: -1 });
postSchema.index({ authorId: 1, type: 1, isActive: 1, isDeleted: 1, _id: -1 });
/** Story tray: type + visibility + author $in + expiresAt range + createdAt sort */
postSchema.index({ type: 1, isActive: 1, isDeleted: 1, authorId: 1, expiresAt: 1, createdAt: -1 });
// Explore sort (viewsCount desc) + trending
postSchema.index({ type: 1, isActive: 1, isDeleted: 1, viewsCount: -1, createdAt: -1 });
postSchema.index({ trendingScore: -1, createdAt: -1 });
postSchema.index({ feedCategory: 1, isActive: 1, isDeleted: 1, _id: -1 });
postSchema.index({ type: 1, feedCategory: 1, trendingScore: -1, createdAt: -1 });
postSchema.index({ mediaJobId: 1 }, { sparse: true });
postSchema.index({ processingStatus: 1, authorId: 1 }, { sparse: true });

export const Post = mongoose.model<PostDoc>("Post", postSchema);
