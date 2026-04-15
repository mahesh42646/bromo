import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface WalletDoc extends Document {
  userId: Types.ObjectId;
  bromoCoins: number;
  createdAt: Date;
  updatedAt: Date;
}

const walletSchema = new Schema<WalletDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    bromoCoins: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

walletSchema.index({ userId: 1 }, { unique: true });

export const Wallet = mongoose.model<WalletDoc>("Wallet", walletSchema);
