import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface OriginalAudioDoc extends Document {
  ownerId: Types.ObjectId;
  sourcePostId: Types.ObjectId;
  title: string;
  audioUrl: string;
  durationMs?: number;
  /** Poster image from source reel/post for picker/detail UI */
  coverUrl?: string;
  /** Aggregate views across all posts using this sound */
  totalViews: number;
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
    coverUrl: { type: String },
    totalViews: { type: Number, default: 0 },
    useCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

originalAudioSchema.index({ title: "text" });
originalAudioSchema.index({ useCount: -1, createdAt: -1 });
originalAudioSchema.index({ totalViews: -1, createdAt: -1 });

export const OriginalAudio = mongoose.model<OriginalAudioDoc>("OriginalAudio", originalAudioSchema);
