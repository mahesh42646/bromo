/**
 * In-process media job queue — MVP without Redis/BullMQ dependency.
 *
 * Jobs run sequentially (one at a time) to avoid saturating CPU on single-server
 * deployments. Swap for BullMQ when horizontal scaling is needed.
 *
 * Flow:
 *   enqueueMediaJob(jobId) → job picked up by runLoop() →
 *     video: packageHls → update Post + MediaJob → createNotification
 *     image: normalizeImage → update Post + MediaJob → createNotification
 */

import fs from "node:fs";
import path from "node:path";
import { MediaJob, type MediaJobDoc } from "../models/MediaJob.js";
import { Post } from "../models/Post.js";
import { packageHls } from "../services/hlsPackager.js";
import { normalizeImage } from "../services/imageNormalize.js";
import { createNotification } from "../models/Notification.js";
import { emitNotification } from "../services/socketService.js";
import { publicUrlForUploadRelative } from "../utils/uploadFiles.js";
import { uploadsRoot } from "../utils/uploadFiles.js";

const UPLOAD_DIR = uploadsRoot();

const queue: string[] = [];
let running = false;

/** Add a job ID to the in-process queue. */
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

async function processVideoJob(
  job: MediaJobDoc,
  jobId: string,
): Promise<void> {
  const result = await packageHls(job.rawRelPath, jobId, (pct) => {
    MediaJob.updateOne({ _id: job._id }, { progress: pct }).catch(() => null);
  });

  const masterUrl = publicUrlForUploadRelative(result.masterRelPath);

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
    await Post.updateOne(
      { _id: job.postDraftId },
      {
        processingStatus: "ready",
        hlsMasterUrl: masterUrl,
        // Store cell master in processingError field? No — store as metadata on job.
        // The mobile client picks master_cell.m3u8 by convention.
        isActive: true,
      },
    );
    // Cleanup raw file after successful HLS packaging
    safeUnlinkRaw(job.rawRelPath);
  }

  await notifyUser(job.userId.toString(), job.postDraftId?.toString(), "ready");
  console.info(`[mediaWorker] job ${jobId} done → ${masterUrl}`);
}

async function processImageJob(
  job: MediaJobDoc,
  jobId: string,
): Promise<void> {
  await MediaJob.updateOne({ _id: job._id }, { progress: 20 });
  const newRel = await normalizeImage(job.rawRelPath);
  const imageUrl = publicUrlForUploadRelative(newRel);

  await MediaJob.updateOne(
    { _id: job._id },
    { status: "ready", progress: 100, imageRelPath: newRel },
  );

  if (job.postDraftId) {
    await Post.updateOne(
      { _id: job.postDraftId },
      {
        processingStatus: "ready",
        mediaUrl: imageUrl,
        isActive: true,
      },
    );
  }

  await notifyUser(job.userId.toString(), job.postDraftId?.toString(), "ready");
  console.info(`[mediaWorker] image job ${jobId} done → ${imageUrl}`);
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

    // Emit real-time socket notification if user is connected
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
