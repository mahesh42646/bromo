import mongoose, { Schema, type Document } from "mongoose";

export const STORE_CATEGORIES = [
  "Fashion & Clothing",
  "Electronics & Tech",
  "Food & Beverages",
  "Health & Beauty",
  "Home & Decor",
  "Sports & Fitness",
  "Grocery",
  "Books & Stationery",
  "Toys & Games",
  "Services",
  "Other",
] as const;

export type StoreCategory = (typeof STORE_CATEGORIES)[number];

export interface StoreDoc extends Document {
  owner: mongoose.Types.ObjectId;
  name: string;
  phone: string;
  city: string;
  address: string;
  location: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat]
  };
  hasDelivery: boolean;
  profilePhoto: string;
  bannerImage: string;
  category: StoreCategory;
  description: string;
  isActive: boolean;
  totalProducts: number;
  totalViews: number;
  ratingAvg: number;
  ratingCount: number;
  tags: string[];
  favoritedBy: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const storeSchema = new Schema<StoreDoc>(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    phone: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true, maxlength: 300 },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    hasDelivery: { type: Boolean, default: false },
    profilePhoto: { type: String, default: "" },
    bannerImage: { type: String, default: "" },
    category: { type: String, enum: STORE_CATEGORIES, required: true },
    description: { type: String, default: "", maxlength: 500 },
    isActive: { type: Boolean, default: true },
    totalProducts: { type: Number, default: 0 },
    totalViews: { type: Number, default: 0 },
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    tags: [{ type: String, trim: true }],
    favoritedBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true },
);

storeSchema.index({ location: "2dsphere" });
storeSchema.index({ owner: 1 }, { unique: true });
storeSchema.index({ city: 1, isActive: 1 });
storeSchema.index({ category: 1, isActive: 1 });
storeSchema.index({ name: "text", description: "text", tags: "text" });

export const Store = mongoose.model<StoreDoc>("Store", storeSchema);
