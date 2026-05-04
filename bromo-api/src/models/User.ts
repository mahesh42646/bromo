import mongoose, { Schema, type Document } from "mongoose";

export type VerificationStatus = "none" | "pending" | "verified" | "rejected";
export type CreatorStatus = "none" | "pending" | "verified" | "rejected";

export interface UserDoc extends Document {
  firebaseUid: string;
  email: string;
  username: string;
  displayName: string;
  emailVerified: boolean;
  profilePicture: string;
  bio: string;
  phone: string;
  website: string;
  provider: "email" | "google";
  isActive: boolean;
  onboardingComplete: boolean;
  interests: string[];
  isPrivate: boolean;
  isVerified: boolean;
  verificationStatus: VerificationStatus;
  verifiedAt?: Date;
  verificationReviewedBy?: mongoose.Types.ObjectId;
  isCreator: boolean;
  creatorStatus: CreatorStatus;
  creatorBadge: boolean;
  creatorForm?: {
    fullName?: string;
    category?: string;
    bio?: string;
    website?: string;
    documents?: string[];
    submittedAt?: Date;
    reviewedAt?: Date;
    rejectionReason?: string;
  };
  fcmTokens: string[];
  blockedUserIds: mongoose.Types.ObjectId[];
  mutedConversationIds: mongoose.Types.ObjectId[];
  rewardPoints: number;
  currentLocation?: {
    type: "Point";
    coordinates: [number, number];
    updatedAt?: Date;
  };
  connectedStore?: {
    enabled: boolean;
    website: string;
    planId: string;
    purchasedAt?: Date;
    /** e.g. shopify | woocommerce | custom */
    provider?: string;
    /** Deep link or catalog feed URL for “Shop now” on posts/reels */
    productCatalogUrl?: string;
    /** When true, store glyph may show without product tags (plan-gated). */
    icon?: boolean;
  };
  followersCount: number;
  followingCount: number;
  postsCount: number;
  storeId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDoc>(
  {
    firebaseUid: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    username: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      minlength: 4,
      maxlength: 30,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    profilePicture: {
      type: String,
      default: "",
    },
    bio: {
      type: String,
      default: "",
      maxlength: 300,
    },
    phone: {
      type: String,
      default: "",
    },
    website: {
      type: String,
      default: "",
    },
    provider: {
      type: String,
      enum: ["email", "google"],
      required: true,
      default: "email",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    onboardingComplete: {
      type: Boolean,
      default: false,
    },
    interests: [{ type: String, trim: true, lowercase: true }],
    isPrivate: {
      type: Boolean,
      default: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
    verificationStatus: {
      type: String,
      enum: ["none", "pending", "verified", "rejected"],
      default: "none",
      index: true,
    },
    verifiedAt: { type: Date },
    verificationReviewedBy: { type: Schema.Types.ObjectId, ref: "Admin" },
    isCreator: {
      type: Boolean,
      default: false,
      index: true,
    },
    creatorStatus: {
      type: String,
      enum: ["none", "pending", "verified", "rejected"],
      default: "none",
      index: true,
    },
    creatorBadge: {
      type: Boolean,
      default: false,
    },
    creatorForm: {
      fullName: { type: String, default: "" },
      category: { type: String, default: "" },
      bio: { type: String, default: "" },
      website: { type: String, default: "" },
      documents: [{ type: String }],
      submittedAt: { type: Date },
      reviewedAt: { type: Date },
      rejectionReason: { type: String, default: "" },
    },
    fcmTokens: [{ type: String }],
    blockedUserIds: [{ type: Schema.Types.ObjectId, ref: "User", index: true }],
    mutedConversationIds: [{ type: Schema.Types.ObjectId, ref: "Conversation" }],
    rewardPoints: {
      type: Number,
      default: 0,
      min: 0,
    },
    currentLocation: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: { type: [Number], default: undefined },
      updatedAt: { type: Date },
    },
    connectedStore: {
      enabled: { type: Boolean, default: false },
      website: { type: String, default: "" },
      planId: { type: String, default: "" },
      purchasedAt: { type: Date },
      provider: { type: String, default: "" },
      productCatalogUrl: { type: String, default: "" },
      icon: { type: Boolean, default: false },
    },
    followersCount: {
      type: Number,
      default: 0,
    },
    followingCount: {
      type: Number,
      default: 0,
    },
    postsCount: {
      type: Number,
      default: 0,
    },
    storeId: {
      type: Schema.Types.ObjectId,
      ref: "Store",
      default: null,
    },
  },
  { timestamps: true },
);

userSchema.index({ followersCount: -1 });
userSchema.index({ currentLocation: "2dsphere" }, { sparse: true });

export const User = mongoose.model<UserDoc>("User", userSchema);
