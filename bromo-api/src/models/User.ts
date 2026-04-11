import mongoose, { Schema, type Document } from "mongoose";

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
  isPrivate: boolean;
  followersCount: number;
  followingCount: number;
  postsCount: number;
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
    isPrivate: {
      type: Boolean,
      default: false,
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
  },
  { timestamps: true },
);

export const User = mongoose.model<UserDoc>("User", userSchema);
