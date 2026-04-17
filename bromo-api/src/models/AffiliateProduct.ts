import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface AffiliateProductDoc extends Document {
  title: string;
  description: string;
  imageUrl: string;
  productUrl: string;
  price: number;
  currency: string;
  category: string;
  brand: string;
  isActive: boolean;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<AffiliateProductDoc>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: "", maxlength: 1000 },
    imageUrl: { type: String, required: true },
    productUrl: { type: String, required: true },
    price: { type: Number, default: 0 },
    currency: { type: String, default: "INR" },
    category: { type: String, default: "general", index: true },
    brand: { type: String, default: "" },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true },
);

schema.index({ isActive: 1, createdAt: -1 });
schema.index({ title: "text", brand: "text", description: "text" });

export const AffiliateProduct = mongoose.model<AffiliateProductDoc>(
  "AffiliateProduct",
  schema,
);
