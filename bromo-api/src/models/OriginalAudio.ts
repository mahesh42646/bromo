import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface OriginalAudioDoc extends Document {
  ownerId: Types.ObjectId;
  sourcePostId: Types.ObjectId;
  title: string;
  audioUrl: string;
  durationMs?: number;
  useCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const originalAudioSchema = new Schema<OriginalAudioDoc>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sourcePostId: { type: Schema.Types.ObjectId, ref: "Post", required: true, unique: true },
    title: { type: String, required: true, trim: true, index: true },
    audioUrl: { type: String, required: true },
    durationMs: { type: Number },
    useCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

originalAudioSchema.index({ title: "text" });
originalAudioSchema.index({ useCount: -1, createdAt: -1 });

export const OriginalAudio = mongoose.model<OriginalAudioDoc>("OriginalAudio", originalAudioSchema);
