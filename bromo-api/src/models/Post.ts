import mongoose, { Schema, type Document, type Types } from "mongoose";

export type StoryOverlay = {
  id: string;
  type: "text" | "emoji" | "music" | "sticker" | "mention" | "link";
  content: string;
  /** 0–1 relative to screen width */
  x: number;
  /** 0–1 relative to screen height */
  y: number;
  color?: string;
  fontSize?: number;
  scale?: number;
  targetUserId?: Types.ObjectId;
  url?: string;
};

export type StoryMeta = {
  /** Solid/gradient background hex for color-background stories */
  bgColor?: string;
  /** Text, emoji, and music badge overlays */
  overlays?: StoryOverlay[];
  canvas?: {
    x?: number;
    y?: number;
    scale?: number;
  };
};

export type CarouselItem = {
  mediaUrl: string;
  mediaType: "image" | "video";
  thumbnailUrl?: string;
  order: number;
  aspectRatio?: number;
  width?: number;
  height?: number;
};

export type ProcessingStatus = "pending" | "processing" | "ready" | "failed";

export type PostSettings = {
  commentsOff?: boolean;
  hideLikes?: boolean;
  allowRemix?: boolean;
  closeFriendsOnly?: boolean;
};

export type LocationMeta = {
  name: string;
  lat?: number;
  lng?: number;
  address?: string;
  placeId?: string;
};

export type PostPoll = {
  question: string;
  options: string[];
  votes: number[];
};

export interface PostDoc extends Document {
  authorId: Types.ObjectId;
  type: "post" | "reel" | "story";
  mediaUrl: string;
  mediaType: "image" | "video";
  thumbnailUrl: string;
  carouselItems: CarouselItem[];
  caption: string;
  location: string;
  locationMeta?: LocationMeta;
  tags: string[];
  taggedUserIds: Types.ObjectId[];
  productIds: Types.ObjectId[];
  collaboratorIds: Types.ObjectId[];
  settings?: PostSettings;
  durationMs?: number;
  music: string;
  likesCount: number;
  commentsCount: number;
  viewsCount: number;
  /** Unique accounts who saw the post (impressions = raw events including repeats) */
  impressionsCount: number;
  sharesCount: number;
  repliesCount: number;
  linkTapsCount: number;
  mentionTapsCount: number;
  storeIconClicksCount: number;
  rewardPointsAccrued: number;
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
  /**
   * Client edit metadata (v2 JSON from `packEditMetaForUpload`): filters, adjust, trim, speed,
   * text/sticker positions (%), products, audio, layoutRef. Persisted through async transcode `$set`;
   * mobile replays overlays + trim/speed on top of decoded video (pixels are not server-baked yet).
   */
  clientEditMeta?: Record<string, unknown>;
  /** Story-only: background color + draggable overlays */
  storyMeta?: StoryMeta;
  originalAudioId?: Types.ObjectId;
  originalAudioTitle?: string;
  /** Licensed catalog track when replacing video audio (remux). */
  musicTrackId?: Types.ObjectId;
  /** Original user upload URL before server-side licensed-audio remux. */
  originalVideoUrl?: string;
  /** Server pipeline: replace embedded audio with licensed track. */
  audioRemuxStatus?: "none" | "pending" | "processing" | "ready" | "failed";
  audioRemuxAttempts?: number;
  audioRemuxError?: string;
  remixOfPostId?: Types.ObjectId;
  remixCredit?: {
    postId?: Types.ObjectId;
    creatorId?: Types.ObjectId;
    username?: string;
  };
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
  poll?: PostPoll;
  scheduledFor?: Date;
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
    carouselItems: [
      {
        mediaUrl: { type: String, required: true },
        mediaType: { type: String, enum: ["image", "video"], required: true },
        thumbnailUrl: { type: String, default: "" },
        order: { type: Number, required: true, min: 0 },
        aspectRatio: { type: Number },
        width: { type: Number },
        height: { type: Number },
      },
    ],
    caption: { type: String, default: "", maxlength: 2200 },
    location: { type: String, default: "" },
    locationMeta: {
      name: String,
      lat: Number,
      lng: Number,
      address: String,
      placeId: String,
    },
    tags: [{ type: String }],
    taggedUserIds: [{ type: Schema.Types.ObjectId, ref: "User", index: true }],
    productIds: [{ type: Schema.Types.ObjectId, ref: "AffiliateProduct" }],
    collaboratorIds: [{ type: Schema.Types.ObjectId, ref: "User", index: true }],
    settings: {
      commentsOff: Boolean,
      hideLikes: Boolean,
      allowRemix: Boolean,
      closeFriendsOnly: Boolean,
    },
    durationMs: { type: Number },
    music: { type: String, default: "" },
    likesCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
    viewsCount: { type: Number, default: 0 },
    impressionsCount: { type: Number, default: 0 },
    sharesCount: { type: Number, default: 0 },
    repliesCount: { type: Number, default: 0 },
    linkTapsCount: { type: Number, default: 0 },
    mentionTapsCount: { type: Number, default: 0 },
    storeIconClicksCount: { type: Number, default: 0 },
    rewardPointsAccrued: { type: Number, default: 0 },
    totalWatchTimeMs: { type: Number, default: 0 },
    avgWatchTimeMs: { type: Number, default: 0 },
    trendingScore: { type: Number, default: 0 },
    expiresAt: { type: Date },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
    clientEditMeta: { type: Schema.Types.Mixed, default: undefined },
    storyMeta: { type: Schema.Types.Mixed, default: undefined },
    originalAudioId: { type: Schema.Types.ObjectId, ref: "OriginalAudio" },
    originalAudioTitle: { type: String, default: "" },
    musicTrackId: { type: Schema.Types.ObjectId, ref: "MusicTrack" },
    originalVideoUrl: { type: String, default: "" },
    audioRemuxStatus: {
      type: String,
      enum: ["none", "pending", "processing", "ready", "failed"],
      default: "none",
      index: true,
    },
    audioRemuxAttempts: { type: Number, default: 0 },
    audioRemuxError: { type: String },
    remixOfPostId: { type: Schema.Types.ObjectId, ref: "Post" },
    remixCredit: {
      postId: { type: Schema.Types.ObjectId, ref: "Post" },
      creatorId: { type: Schema.Types.ObjectId, ref: "User" },
      username: { type: String, default: "" },
    },
    hlsMasterUrl: { type: String },
    processingStatus: {
      type: String,
      enum: ["pending", "processing", "ready", "failed"],
      default: undefined,
    },
    processingError: { type: String },
    mediaJobId: { type: Schema.Types.ObjectId, ref: "MediaJob" },
    feedCategory: { type: String, default: "general", index: true },
    poll: {
      question: { type: String, maxlength: 140, default: "" },
      options: [{ type: String, maxlength: 80 }],
      votes: [{ type: Number, min: 0 }],
    },
    scheduledFor: { type: Date, default: undefined, index: true },
  },
  { timestamps: true },
);

postSchema.index({ authorId: 1, createdAt: -1 });
postSchema.index({ type: 1, createdAt: -1 });
postSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// Fast feed/reels lookup — covers the query filter + _id sort in one index scan
postSchema.index({ type: 1, isActive: 1, isDeleted: 1, _id: -1 });
postSchema.index({ authorId: 1, type: 1, isActive: 1, isDeleted: 1, _id: -1 });
postSchema.index({ collaboratorIds: 1, type: 1, isActive: 1, isDeleted: 1, _id: -1 });
/** Story tray: type + visibility + author $in + expiresAt range + createdAt sort */
postSchema.index({ type: 1, isActive: 1, isDeleted: 1, authorId: 1, expiresAt: 1, createdAt: -1 });
// Explore sort (viewsCount desc) + trending
postSchema.index({ type: 1, isActive: 1, isDeleted: 1, viewsCount: -1, createdAt: -1 });
postSchema.index({ trendingScore: -1, createdAt: -1 });
postSchema.index({ feedCategory: 1, isActive: 1, isDeleted: 1, _id: -1 });
postSchema.index({ type: 1, feedCategory: 1, trendingScore: -1, createdAt: -1 });
postSchema.index({ mediaJobId: 1 }, { sparse: true });
postSchema.index({ processingStatus: 1, authorId: 1 }, { sparse: true });
postSchema.index({ scheduledFor: 1, isActive: 1, isDeleted: 1 });

export const Post = mongoose.model<PostDoc>("Post", postSchema);
