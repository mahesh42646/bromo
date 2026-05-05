import type { Types } from "mongoose";
import { OriginalAudio } from "../models/OriginalAudio.js";
import { Post } from "../models/Post.js";
import { User } from "../models/User.js";
import { extractOriginalAudioTrack, getVideoDuration } from "./mediaProcessor.js";
import { publicUrlForUploadRelative } from "../utils/uploadFiles.js";
import { mirrorUploadRelative } from "./s3Mirror.js";

export async function ensureOriginalAudioForPost(input: {
  postId: string | Types.ObjectId;
  ownerId: string | Types.ObjectId;
  sourceRelPath: string;
}): Promise<void> {
  try {
    const [existing, owner, sourcePost] = await Promise.all([
      OriginalAudio.findOne({ sourcePostId: input.postId }).select("_id").lean(),
      User.findById(input.ownerId).select("username displayName").lean(),
      Post.findById(input.postId).select("caption thumbnailUrl mediaUrl feedCategory").lean(),
    ]);
    if (existing) return;

    const username =
      typeof owner?.username === "string" && owner.username.trim()
        ? owner.username.trim()
        : owner?.displayName?.trim() || "Creator";
    const captionRaw =
      sourcePost && typeof (sourcePost as { caption?: unknown }).caption === "string"
        ? (sourcePost as { caption: string }).caption.trim()
        : "";
    const snippet = captionRaw.split(/\s+/).slice(0, 6).join(" ").trim();
    const title = snippet
      ? `${username} — ${snippet}`
      : `${username} — Original audio`;

    let durationMs: number | undefined;
    try {
      const sec = await getVideoDuration(input.sourceRelPath);
      if (sec > 0 && Number.isFinite(sec)) durationMs = Math.round(sec * 1000);
    } catch {
      durationMs = undefined;
    }

    let coverUrl: string | undefined;
    if (sourcePost) {
      const sp = sourcePost as { thumbnailUrl?: string; mediaUrl?: string };
      const raw =
        typeof sp.thumbnailUrl === "string" && sp.thumbnailUrl.trim()
          ? sp.thumbnailUrl.trim()
          : typeof sp.mediaUrl === "string"
            ? sp.mediaUrl.trim()
            : "";
      coverUrl = raw || undefined;
    }

    const audioRel = await extractOriginalAudioTrack(input.sourceRelPath, String(input.ownerId));
    const audioUrl = publicUrlForUploadRelative(audioRel);

    let sourceFeedCategory = "general";
    if (sourcePost) {
      const raw = (sourcePost as { feedCategory?: string }).feedCategory;
      if (typeof raw === "string" && raw.trim()) {
        sourceFeedCategory = raw.trim().toLowerCase();
      }
    }

    const audio = await OriginalAudio.create({
      ownerId: input.ownerId,
      sourcePostId: input.postId,
      title,
      audioUrl,
      sourceFeedCategory,
      ...(durationMs !== undefined ? { durationMs } : {}),
      ...(coverUrl ? { coverUrl } : {}),
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
