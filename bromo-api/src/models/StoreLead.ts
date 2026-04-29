import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface StoreLeadDoc extends Document {
  store: Types.ObjectId;
  buyer: Types.ObjectId;
  owner: Types.ObjectId;
  contactName: string;
  phone: string;
  quantity: string;
  details: string;
  status: "new" | "contacted" | "closed" | "rejected";
  createdAt: Date;
  updatedAt: Date;
}

const storeLeadSchema = new Schema<StoreLeadDoc>(
  {
    store: { type: Schema.Types.ObjectId, ref: "Store", required: true, index: true },
    buyer: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    contactName: { type: String, required: true, trim: true, maxlength: 100 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    quantity: { type: String, default: "", maxlength: 120 },
    details: { type: String, default: "", maxlength: 1000 },
    status: { type: String, enum: ["new", "contacted", "closed", "rejected"], default: "new" },
  },
  { timestamps: true },
);

storeLeadSchema.index({ store: 1, createdAt: -1 });
storeLeadSchema.index({ owner: 1, createdAt: -1 });

export const StoreLead = mongoose.model<StoreLeadDoc>("StoreLead", storeLeadSchema);
