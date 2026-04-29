import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface MessageDoc extends Document {
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  type: "text" | "image" | "video" | "audio" | "gif" | "sticker" | "location" | "shared_post";
  text: string;
  mediaUrl: string;
  meta: Record<string, unknown>;
  replyToId?: Types.ObjectId;
  isUnsent: boolean;
  editedAt?: Date;
  reactions: Array<{ userId: Types.ObjectId; emoji: string }>;
  readBy: Array<{ userId: Types.ObjectId; readAt: Date }>;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<MessageDoc>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: ["text", "image", "video", "audio", "gif", "sticker", "location", "shared_post"],
      required: true,
    },
    text: { type: String, default: "" },
    mediaUrl: { type: String, default: "" },
    meta: { type: Schema.Types.Mixed, default: {} },
    replyToId: { type: Schema.Types.ObjectId, ref: "Message" },
    isUnsent: { type: Boolean, default: false },
    editedAt: { type: Date },
    reactions: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User" },
        emoji: { type: String, required: true },
      },
    ],
    readBy: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User" },
        readAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

messageSchema.index({ conversationId: 1, createdAt: 1 });

export const Message = mongoose.model<MessageDoc>("Message", messageSchema);
