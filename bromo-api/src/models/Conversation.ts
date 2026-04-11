import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface ConversationDoc extends Document {
  participants: Types.ObjectId[];
  lastMessageText: string;
  lastMessageAt: Date;
  lastMessageSenderId?: Types.ObjectId;
  isGroup: boolean;
  groupName: string;
  groupAvatar: string;
  unreadCounts: Map<string, number>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<ConversationDoc>(
  {
    participants: [{ type: Schema.Types.ObjectId, ref: "User" }],
    lastMessageText: { type: String, default: "" },
    lastMessageAt: { type: Date, default: Date.now },
    lastMessageSenderId: { type: Schema.Types.ObjectId, ref: "User" },
    isGroup: { type: Boolean, default: false },
    groupName: { type: String, default: "" },
    groupAvatar: { type: String, default: "" },
    unreadCounts: { type: Map, of: Number, default: {} },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

conversationSchema.index({ participants: 1 });
conversationSchema.index({ lastMessageAt: -1 });

export const Conversation = mongoose.model<ConversationDoc>("Conversation", conversationSchema);
