import mongoose, { Schema, type Document } from "mongoose";

export interface StoreProductDoc extends Document {
  store: mongoose.Types.ObjectId;
  owner: mongoose.Types.ObjectId;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  category: string;
  photos: string[];
  inStock: boolean;
  tags: string[];
  viewsCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const storeProductSchema = new Schema<StoreProductDoc>(
  {
    store: { type: Schema.Types.ObjectId, ref: "Store", required: true, index: true },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, default: "", maxlength: 1000 },
    price: { type: Number, required: true, min: 0 },
    originalPrice: { type: Number, min: 0 },
    category: { type: String, required: true, trim: true },
    photos: [{ type: String }],
    inStock: { type: Boolean, default: true },
    tags: [{ type: String, trim: true }],
    viewsCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

storeProductSchema.index({ store: 1, isActive: 1 });
storeProductSchema.index({ store: 1, category: 1 });
storeProductSchema.index({ name: "text", description: "text", tags: "text" });

export const StoreProduct = mongoose.model<StoreProductDoc>("StoreProduct", storeProductSchema);
