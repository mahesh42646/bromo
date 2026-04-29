import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface StoreRedemptionDoc extends Document {
  store: Types.ObjectId;
  user: Types.ObjectId;
  owner: Types.ObjectId;
  orderTotalInr: number;
  coinsDeducted: number;
  discountPercent: number;
  payableInr: number;
  status: "pending" | "redeemed" | "cancelled";
  qrToken: string;
  redeemedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const storeRedemptionSchema = new Schema<StoreRedemptionDoc>(
  {
    store: { type: Schema.Types.ObjectId, ref: "Store", required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    orderTotalInr: { type: Number, required: true, min: 0 },
    coinsDeducted: { type: Number, required: true, min: 0 },
    discountPercent: { type: Number, required: true, min: 0 },
    payableInr: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["pending", "redeemed", "cancelled"], default: "pending", index: true },
    qrToken: { type: String, required: true, unique: true },
    redeemedAt: { type: Date },
  },
  { timestamps: true },
);

storeRedemptionSchema.index({ store: 1, createdAt: -1 });
storeRedemptionSchema.index({ user: 1, createdAt: -1 });

export const StoreRedemption = mongoose.model<StoreRedemptionDoc>("StoreRedemption", storeRedemptionSchema);
