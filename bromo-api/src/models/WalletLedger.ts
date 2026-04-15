import mongoose, { Schema, type Document, type Types } from "mongoose";

export type LedgerReason =
  | "topup"
  | "promotion_spend"
  | "promotion_refund"
  | "admin_credit"
  | "admin_debit"
  | "referral_reward";

export interface WalletLedgerDoc extends Document {
  userId: Types.ObjectId;
  delta: number; // positive = credit, negative = debit
  balanceAfter: number;
  reason: LedgerReason;
  refType?: "Promotion" | "Admin";
  refId?: Types.ObjectId;
  meta?: Record<string, unknown>;
  idempotencyKey?: string;
  createdAt: Date;
}

const walletLedgerSchema = new Schema<WalletLedgerDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    delta: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    reason: {
      type: String,
      enum: ["topup", "promotion_spend", "promotion_refund", "admin_credit", "admin_debit", "referral_reward"],
      required: true,
    },
    refType: { type: String, enum: ["Promotion", "Admin"] },
    refId: { type: Schema.Types.ObjectId },
    meta: { type: Schema.Types.Mixed },
    idempotencyKey: { type: String, sparse: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

walletLedgerSchema.index({ userId: 1, createdAt: -1 });
// Idempotency: prevent double-charges on retry
walletLedgerSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

export const WalletLedger = mongoose.model<WalletLedgerDoc>("WalletLedger", walletLedgerSchema);
