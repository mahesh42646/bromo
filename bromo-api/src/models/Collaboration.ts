import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface CollaborationDoc extends Document {
  brandUserId: Types.ObjectId;
  creatorUserId: Types.ObjectId;
  title: string;
  brief: string;
  paid: boolean;
  payoutCoins?: number;
  status: "invited" | "accepted" | "declined" | "completed";
  createdAt: Date;
  updatedAt: Date;
}

const collaborationSchema = new Schema<CollaborationDoc>(
  {
    brandUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    creatorUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true },
    brief: { type: String, default: "" },
    paid: { type: Boolean, default: false },
    payoutCoins: { type: Number },
    status: {
      type: String,
      enum: ["invited", "accepted", "declined", "completed"],
      default: "invited",
    },
  },
  { timestamps: true },
);

export const Collaboration = mongoose.model<CollaborationDoc>("Collaboration", collaborationSchema);
