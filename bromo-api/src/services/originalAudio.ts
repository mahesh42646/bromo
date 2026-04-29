import type { Types } from "mongoose";
import { OriginalAudio } from "../models/OriginalAudio.js";
import { Post } from "../models/Post.js";
import { User } from "../models/User.js";
import { extractOriginalAudioTrack } from "./mediaProcessor.js";
import { publicUrlForUploadRelative } from "../utils/uploadFiles.js";
import { mirrorUploadRelative } from "./s3Mirror.js";

export async function ensureOriginalAudioForPost(input: {
  postId: string | Types.ObjectId;
  ownerId: string | Types.ObjectId;
  sourceRelPath: string;
}): Promise<void> {
  try {
    const [existing, owner] = await Promise.all([
      OriginalAudio.findOne({ sourcePostId: input.postId }).select("_id").lean(),
      User.findById(input.ownerId).select("username displayName").lean(),
    ]);
    if (existing) return;

    const username =
      typeof owner?.username === "string" && owner.username.trim()
        ? owner.username.trim()
        : owner?.displayName?.trim() || "Creator";
    const title = `${username} - Original Audio`;
    const audioRel = await extractOriginalAudioTrack(input.sourceRelPath, String(input.ownerId));
    const audioUrl = publicUrlForUploadRelative(audioRel);

    const audio = await OriginalAudio.create({
      ownerId: input.ownerId,
      sourcePostId: input.postId,
      title,
      audioUrl,
      isActive: true,
    });

    await Post.updateOne(
      { _id: input.postId },
      { $set: { originalAudioId: audio._id, originalAudioTitle: title } },
    );
    void mirrorUploadRelative(audioRel).catch(() => null);
  } catch (err) {
    console.warn("[originalAudio] extraction skipped:", err instanceof Error ? err.message : err);
  }
}
