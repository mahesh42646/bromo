/**
 * In-process media job queue — MVP without Redis/BullMQ dependency.
 *
 * Flow:
 *   enqueueMediaJob(jobId) → runLoop() →
 *     video: packageHls + encodeMezzanineMp4 → update Post + MediaJob → notify + emitStoryNew
 *     image: normalizeImage → update Post + MediaJob → notify
 */

import "../config/ffmpegInit.js";

import fs from "node:fs";
import path from "node:path";
import { MediaJob, type MediaJobDoc } from "../models/MediaJob.js";
import { Post } from "../models/Post.js";
import { User } from "../models/User.js";
import { packageHls, encodeMezzanineMp4 } from "../services/hlsPackager.js";
import { generateVideoThumbnail } from "../services/mediaProcessor.js";
import { ensureOriginalAudioForPost } from "../services/originalAudio.js";
import { normalizeImage } from "../services/imageNormalize.js";
import { createNotification } from "../models/Notification.js";
import { emitNotification, emitPostNew, emitStoryNew } from "../services/socketService.js";
import { rewritePublicMediaUrl } from "../utils/publicMediaUrl.js";
import { postForSocketBroadcast } from "../utils/postSocketPayload.js";
import { publicUrlForUploadRelative } from "../utils/uploadFiles.js";
import { uploadsRoot } from "../utils/uploadFiles.js";
import {
  isS3MirrorConfigured,
  mirrorUploadRelative,
  mirrorUploadTreeRelative,
} from "../services/s3Mirror.js";
import { enqueueLicensedAudioRemuxForPost } from "../services/audioRemuxEnqueue.js";

const UPLOAD_DIR = uploadsRoot();

const POST_AUTHOR_SELECT =
  "username displayName profilePicture isPrivate emailVerified followersCount";

async function broadcastActivatedPost(postId: string): Promise<void> {
  const populated = await Post.findById(postId).populate("authorId", POST_AUTHOR_SELECT).lean();
  if (!populated) return;

  const p = populated as unknown as Record<string, unknown>;
  const typ = String(p.type ?? "");
  const authorLean = p.authorId as Record<string, unknown> | null | undefined;
  const authorIdStr = authorLean ? String(authorLean._id ?? "") : "";

  if (typ === "story") {
    if (authorIdStr) emitStoryNew(authorIdStr);
    return;
  }

  const base = postForSocketBroadcast(p);
  if (!base) return;

  const mediaUrl = typeof base.mediaUrl === "string" ? rewritePublicMediaUrl(base.mediaUrl) : base.mediaUrl;
  const thumbnailUrl =
    typeof base.thumbnailUrl === "string" ? rewritePublicMediaUrl(base.thumbnailUrl) : base.thumbnailUrl;
  const hlsMasterUrl =
    typeof base.hlsMasterUrl === "string" && String(base.hlsMasterUrl).trim()
      ? rewritePublicMediaUrl(String(base.hlsMasterUrl))
      : base.hlsMasterUrl;

  let author = base.author as Record<string, unknown> | undefined;
  if (author) {
    author = {
      ...author,
      profilePicture:
        typeof author.profilePicture === "string"
          ? rewritePublicMediaUrl(author.profilePicture)
          : author.profilePicture,
      followersCount: Number(author.followersCount) || 0,
    };
  }

  emitPostNew({
    ...base,
    mediaUrl,
    thumbnailUrl,
    hlsMasterUrl,
    author,
    likesCount: Number(base.likesCount) || 0,
    commentsCount: Number(base.commentsCount) || 0,
    viewsCount: Number(base.viewsCount) || 0,
    isLiked: false,
  } as object);
}

const queue: string[] = [];
let running = false;

export function enqueueMediaJob(jobId: string): void {
  queue.push(jobId);
  if (!running) {
    void runLoop();
  }
}

async function runLoop(): Promise<void> {
  running = true;
  while (queue.length > 0) {
    const jobId = queue.shift()!;
    try {
      await processJob(jobId);
    } catch (err) {
      console.error("[mediaWorker] unhandled job error:", jobId, err);
    }
  }
  running = false;
}

async function processJob(jobId: string): Promise<void> {
  const job = await MediaJob.findById(jobId);
  if (!job) {
    console.warn("[mediaWorker] job not found:", jobId);
    return;
  }

  console.info(`[mediaWorker] starting job ${jobId} (${job.category}, ${job.mediaType})`);

  await MediaJob.updateOne({ _id: job._id }, { status: "processing", progress: 0 });
  if (job.postDraftId) {
    await Post.updateOne({ _id: job.postDraftId }, { processingStatus: "processing" });
  }

  try {
    if (job.mediaType === "image") {
      await processImageJob(job, jobId);
    } else {
      await processVideoJob(job, jobId);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[mediaWorker] job ${jobId} failed:`, msg);

    await MediaJob.updateOne({ _id: job._id }, { status: "failed", error: msg });
    if (job.postDraftId) {
      await Post.updateOne(
        { _id: job.postDraftId },
        { processingStatus: "failed", processingError: msg },
      );
    }
    await notifyUser(job.userId.toString(), job.postDraftId?.toString(), "failed");
  }
}

async function processVideoJob(job: MediaJobDoc, jobId: string): Promise<void> {
  const result = await packageHls(job.rawRelPath, jobId, (pct) => {
    MediaJob.updateOne({ _id: job._id }, { progress: Math.min(89, Math.round(pct)) }).catch(() => null);
  });

  const mezzanineRel = await encodeMezzanineMp4(job.rawRelPath, jobId, result.probe, result.rungs);
  const masterUrl = publicUrlForUploadRelative(result.masterRelPath);
  const mezzanineUrl = publicUrlForUploadRelative(mezzanineRel);

  let mezzanineThumbnailUrl = "";
  let thumbRel: string | undefined;
  try {
    thumbRel = await generateVideoThumbnail(mezzanineRel);
    mezzanineThumbnailUrl = publicUrlForUploadRelative(thumbRel);
  } catch (e) {
    console.warn("[mediaWorker] mezzanine thumbnail failed:", e);
  }

  const hlsTreeDir = path.posix.dirname(result.masterRelPath);
  if (isS3MirrorConfigured()) {
    try {
      await mirrorUploadTreeRelative(hlsTreeDir);
      await mirrorUploadRelative(mezzanineRel);
      if (thumbRel) await mirrorUploadRelative(thumbRel);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      console.error("[mediaWorker] S3/CloudFront mirror failed (object not at CDN yet):", detail);
      throw new Error(
        "Video is ready on the server but could not be copied to CDN. Check S3 permissions and try again.",
      );
    }
  }

  await MediaJob.updateOne(
    { _id: job._id },
    {
      status: "ready",
      progress: 100,
      hlsMasterRelPath: result.masterRelPath,
      renditions: result.renditions,
    },
  );

  if (job.postDraftId) {
    const existing = await Post.findById(job.postDraftId).select("type expiresAt scheduledFor").lean();
    const scheduledFor =
      existing?.scheduledFor instanceof Date
        ? existing.scheduledFor
        : existing?.scheduledFor
          ? new Date(existing.scheduledFor as Date)
          : undefined;
    const activateNow = !scheduledFor || Number.isNaN(scheduledFor.getTime()) || scheduledFor.getTime() <= Date.now();
    const readyPatch: Record<string, unknown> = {
      processingStatus: "ready",
      hlsMasterUrl: masterUrl,
      mediaUrl: mezzanineUrl,
      thumbnailUrl: mezzanineThumbnailUrl,
      isActive: activateNow,
    };
    if (activateNow && existing?.type === "story" && !existing.expiresAt) {
      readyPatch.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }
    await Post.updateOne({ _id: job.postDraftId }, { $set: readyPatch });

    void ensureOriginalAudioForPost({
      postId: job.postDraftId,
      ownerId: job.userId,
      sourceRelPath: mezzanineRel,
    });

    void enqueueLicensedAudioRemuxForPost(job.postDraftId, mezzanineRel).catch((e) =>
      console.warn("[mediaWorker] licensed audio remux enqueue:", e),
    );

    if (activateNow) {
      await broadcastActivatedPost(String(job.postDraftId));
    }

    if (activateNow && (existing?.type === "post" || existing?.type === "reel")) {
      await User.findByIdAndUpdate(job.userId, { $inc: { postsCount: 1 } }).catch((e) =>
        console.warn("[mediaWorker] postsCount increment failed:", e),
      );
    }

    safeUnlinkRaw(job.rawRelPath);
  }

  await notifyUser(job.userId.toString(), job.postDraftId?.toString(), "ready");
  console.info(`[mediaWorker] job ${jobId} done → HLS ${masterUrl}, MP4 ${mezzanineUrl}`);

  if (!isS3MirrorConfigured()) {
    void mirrorUploadTreeRelative(hlsTreeDir)
      .then(() => mirrorUploadRelative(mezzanineRel))
      .then(() => (thumbRel ? mirrorUploadRelative(thumbRel) : Promise.resolve()))
      .catch((e) => console.warn("[s3Mirror] video mirror (optional):", e));
  }
}

async function processImageJob(job: MediaJobDoc, jobId: string): Promise<void> {
  await MediaJob.updateOne({ _id: job._id }, { progress: 20 });
  const newRel = await normalizeImage(job.rawRelPath);
  const imageUrl = publicUrlForUploadRelative(newRel);

  if (isS3MirrorConfigured()) {
    try {
      await mirrorUploadRelative(newRel);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      console.error("[mediaWorker] image S3 mirror failed:", detail);
      throw new Error("Image could not be copied to CDN. Check S3 permissions and try again.");
    }
  }

  await MediaJob.updateOne(
    { _id: job._id },
    { status: "ready", progress: 100, imageRelPath: newRel },
  );

  if (job.postDraftId) {
    const existing = await Post.findById(job.postDraftId).select("type expiresAt scheduledFor").lean();
    const scheduledFor =
      existing?.scheduledFor instanceof Date
        ? existing.scheduledFor
        : existing?.scheduledFor
          ? new Date(existing.scheduledFor as Date)
          : undefined;
    const activateNow = !scheduledFor || Number.isNaN(scheduledFor.getTime()) || scheduledFor.getTime() <= Date.now();
    const readyPatch: Record<string, unknown> = {
      processingStatus: "ready",
      mediaUrl: imageUrl,
      isActive: activateNow,
    };
    if (activateNow && existing?.type === "story" && !existing.expiresAt) {
      readyPatch.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }
    await Post.updateOne({ _id: job.postDraftId }, { $set: readyPatch });

    if (activateNow) {
      await broadcastActivatedPost(String(job.postDraftId));
    }

    if (activateNow && (existing?.type === "post" || existing?.type === "reel")) {
      await User.findByIdAndUpdate(job.userId, { $inc: { postsCount: 1 } }).catch((e) =>
        console.warn("[mediaWorker] postsCount increment failed:", e),
      );
    }

    safeUnlinkRaw(job.rawRelPath);
  }

  await notifyUser(job.userId.toString(), job.postDraftId?.toString(), "ready");
  console.info(`[mediaWorker] image job ${jobId} done → ${imageUrl}`);

  if (!isS3MirrorConfigured()) {
    void mirrorUploadRelative(newRel).catch((e) => console.warn("[s3Mirror] image mirror (optional):", e));
  }
}

async function notifyUser(
  userId: string,
  postId: string | undefined,
  result: "ready" | "failed",
): Promise<void> {
  try {
    const message =
      result === "ready"
        ? "Your content is ready — tap to view!"
        : "Media processing failed. Please try again.";

    await createNotification({
      recipientId: userId,
      actorId: userId,
      type: "media_ready",
      postId: postId,
      message,
    });

    emitNotification(userId, "media_ready", userId, postId ?? "", message);
  } catch (err) {
    console.warn("[mediaWorker] notification failed:", err);
  }
}

function safeUnlinkRaw(relPath: string): void {
  if (!relPath || relPath.includes("..")) return;
  const abs = path.join(UPLOAD_DIR, ...relPath.split("/"));
  const resolved = path.resolve(abs);
  if (!resolved.startsWith(UPLOAD_DIR + path.sep)) return;
  try {
    if (fs.existsSync(resolved)) fs.unlinkSync(resolved);
  } catch (e) {
    console.warn("[mediaWorker] raw cleanup failed:", e);
  }
}

