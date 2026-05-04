/**
 * Polling worker: replace embedded video audio with a licensed catalog track (FFmpeg remux).
 */

import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { Post } from "../models/Post.js";
import { MusicTrack } from "../models/MusicTrack.js";
import { createNotification } from "../models/Notification.js";
import { emitNotification } from "../services/socketService.js";
import { remuxVideoWithLicensedAudio, getVideoDuration } from "../services/mediaProcessor.js";
import {
  publicUrlForUploadRelative,
  uploadRelativePathFromUrl,
  uploadsRoot,
  safeUnlinkUploadRelative,
} from "../utils/uploadFiles.js";

const UPLOAD_DIR = uploadsRoot();
const RUN_INTERVAL_MS = process.env.NODE_ENV === "production" ? 30 * 1000 : 45 * 1000;
const MAX_ATTEMPTS = 3;

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

function trimSpanFromMeta(
  meta: Record<string, unknown> | undefined,
  durationSec: number,
): { videoStartSec: number; segmentDurationSec: number } {
  const d = Math.max(0.05, durationSec);
  const ts = meta?.trimStartByAsset as Record<string, number> | undefined;
  const te = meta?.trimEndByAsset as Record<string, number> | undefined;
  const t0 = typeof ts?.["0"] === "number" ? ts["0"] : typeof ts?.[0] === "number" ? ts[0] : 0;
  const t1 = typeof te?.["0"] === "number" ? te["0"] : typeof te?.[0] === "number" ? te[0] : 1;
  const span = Math.max(0.05, (Math.min(1, t1) - Math.max(0, t0)) * d);
  const start = Math.max(0, t0) * d;
  return { videoStartSec: start, segmentDurationSec: span };
}

async function processOne(): Promise<void> {
  const leased = await Post.findOneAndUpdate(
    {
      audioRemuxStatus: "pending",
      audioRemuxAttempts: { $lt: MAX_ATTEMPTS },
      musicTrackId: { $exists: true, $ne: null },
    },
    { $set: { audioRemuxStatus: "processing" } },
    { sort: { createdAt: 1 }, new: true },
  ).exec();

  if (!leased || !leased.musicTrackId) return;

  const post = leased;

  try {
    const track = await MusicTrack.findById(post.musicTrackId).lean();
    const audioRel = track?.audioRelPath?.trim();
    if (!track || track.license !== "catalog" || !audioRel) {
      await Post.updateOne(
        { _id: post._id },
        {
          $set: {
            audioRemuxStatus: "failed",
            audioRemuxError: "Licensed audio file not configured for this track",
          },
        },
      );
      return;
    }

    const meta = post.clientEditMeta as Record<string, unknown> | undefined;
    const rawVideoRel =
      typeof post.originalVideoUrl === "string" && post.originalVideoUrl.length > 0
        ? post.originalVideoUrl.replace(/^\/+/, "").replace(/^uploads\//, "")
        : uploadRelativePathFromUrl(post.mediaUrl ?? "") ?? "";

    if (!rawVideoRel || rawVideoRel.includes("..")) {
      throw new Error("Could not resolve video path");
    }

    const videoAbs = path.join(UPLOAD_DIR, ...rawVideoRel.split("/"));
    const audioAbs = path.join(UPLOAD_DIR, ...audioRel.split("/"));
    if (!fs.existsSync(videoAbs) || !fs.existsSync(audioAbs)) {
      throw new Error("Missing video or audio source file on disk");
    }

    const durSec =
      typeof post.durationMs === "number" && post.durationMs > 0
        ? post.durationMs / 1000
        : await getVideoDuration(rawVideoRel);

    const trim = trimSpanFromMeta(meta, durSec);

    const outRel = path.posix.join(
      path.posix.dirname(rawVideoRel),
      `remux_${String(post._id)}_${Date.now()}.mp4`,
    );

    remuxVideoWithLicensedAudio({
      videoRel: rawVideoRel,
      audioRel,
      outRel,
      videoStartSec: trim.videoStartSec,
      segmentDurationSec: trim.segmentDurationSec,
      audioStartSec: 0,
    });

    const outUrl = publicUrlForUploadRelative(outRel);
    const prevUrl = post.mediaUrl;

    await Post.updateOne(
      { _id: post._id },
      {
        $set: {
          mediaUrl: outUrl,
          audioRemuxStatus: "ready",
          audioRemuxError: "",
        },
      },
    );

    const prevRel = uploadRelativePathFromUrl(prevUrl ?? "");
    if (prevRel && prevRel !== outRel) {
      safeUnlinkUploadRelative(prevRel);
    }

    const uid = String(post.authorId);
    const msg = "Your reel audio has been mixed with the licensed track.";
    await createNotification({
      recipientId: new mongoose.Types.ObjectId(uid),
      actorId: new mongoose.Types.ObjectId(uid),
      type: "media_ready",
      postId: post._id,
      message: msg,
    });
    emitNotification(uid, "media_ready", uid, String(post._id), msg);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const nextAttempts = (post.audioRemuxAttempts ?? 0) + 1;
    const failed = nextAttempts >= MAX_ATTEMPTS;
    await Post.updateOne(
      { _id: post._id },
      {
        $set: {
          audioRemuxAttempts: nextAttempts,
          audioRemuxStatus: failed ? "failed" : "pending",
          audioRemuxError: msg,
        },
      },
    );

    if (failed) {
      const uid = String(post.authorId);
      const nmsg = "Audio mixing failed after multiple tries. Your original upload is still visible.";
      await createNotification({
        recipientId: new mongoose.Types.ObjectId(uid),
        actorId: new mongoose.Types.ObjectId(uid),
        type: "media_ready",
        postId: post._id,
        message: nmsg,
      }).catch(() => null);
      emitNotification(uid, "media_ready", uid, String(post._id), nmsg);
    }
  }
}

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await processOne();
  } finally {
    running = false;
  }
}

export function startAudioRemuxWorker(): void {
  if (timer) return;
  void tick();
  timer = setInterval(() => {
    void tick();
  }, RUN_INTERVAL_MS);
  if (typeof timer.unref === "function") timer.unref();
}

export function stopAudioRemuxWorker(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
