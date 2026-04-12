import ffmpeg from "fluent-ffmpeg";
import path from "node:path";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { bundledFfmpegPath } from "../config/ffmpegInit.js";
import { uploadsRoot } from "../utils/uploadFiles.js";
import type { UploadCategory } from "../utils/uploadFiles.js";
import { VIDEO_EXTENSIONS } from "../utils/uploadPolicy.js";

const UPLOAD_DIR = uploadsRoot();

export type ProbeInfo = {
  hasVideoStream: boolean;
  hasAudioStream: boolean;
  formatDurationSec: number;
  videoCodec?: string;
};

function absFromRel(rel: string): string {
  const clean = rel.replace(/^\/+/, "").split("/").join(path.sep);
  return path.join(UPLOAD_DIR, clean);
}

/**
 * Probe container/streams using bundled `ffmpeg -i` stderr.
 * Avoids requiring `ffprobe` on PATH (fluent-ffmpeg ffprobe needs it unless setFfprobePath).
 */
function probeMediaWithFfmpeg(absPath: string): ProbeInfo {
  const bin = bundledFfmpegPath;
  if (!bin) {
    throw new Error("ffmpeg binary not available for this platform");
  }
  const r = spawnSync(bin, ["-hide_banner", "-i", absPath], {
    encoding: "utf-8",
    maxBuffer: 25 * 1024 * 1024,
    windowsHide: true,
  });
  const stderr = String(r.stderr ?? "");
  if (r.error) {
    throw r.error;
  }
  if (
    /No such file or directory/i.test(stderr) ||
    /Invalid data found when processing input/i.test(stderr) ||
    /moov atom not found/i.test(stderr)
  ) {
    throw new Error(stderr.slice(0, 400));
  }
  if (!/Input\s+#0/i.test(stderr)) {
    throw new Error(stderr.slice(0, 400));
  }

  const durMatch = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  let formatDurationSec = 0;
  if (durMatch) {
    formatDurationSec =
      Number(durMatch[1]) * 3600 + Number(durMatch[2]) * 60 + Number(durMatch[3]);
  }

  const hasVideoStream = /Stream\s+#\d+:\d+(?:\([^)]*\))?:\s*Video:/i.test(stderr);
  const hasAudioStream = /Stream\s+#\d+:\d+(?:\([^)]*\))?:\s*Audio:/i.test(stderr);
  const videoLine = stderr.match(
    /Stream\s+#\d+:\d+(?:\([^)]*\))?:\s*Video:\s*([a-zA-Z0-9_]+)/i,
  );
  const videoCodec = videoLine?.[1]?.toLowerCase();

  return {
    hasVideoStream,
    hasAudioStream,
    formatDurationSec,
    videoCodec,
  };
}

export function ffprobeFile(absPath: string): Promise<ProbeInfo> {
  return Promise.resolve(probeMediaWithFfmpeg(absPath));
}

/** H.264 + MP4/MOV/M4V — keep original bytes (no re-encode). */
function isH264InFriendlyContainer(ext: string, codec: string | undefined): boolean {
  const c = (codec ?? "").toLowerCase();
  if (c !== "h264") return false;
  const e = ext.toLowerCase();
  return e === ".mp4" || e === ".mov" || e === ".m4v";
}

/**
 * Re-encode to H.264/AAC MP4 when container/codec is risky for mobile players.
 * Keeps originals for plain H.264 in MP4/MOV/M4V.
 */
export function needsTranscodeToMp4(ext: string, probe: ProbeInfo): boolean {
  const e = ext.toLowerCase();
  if (!probe.hasVideoStream) return false;
  if (e === ".heic" || e === ".heif") return true;
  if (e === ".webm" || e === ".mkv" || e === ".avi" || e === ".mpeg" || e === ".mpg" || e === ".3gp") return true;
  if (isH264InFriendlyContainer(e, probe.videoCodec)) return false;
  const c = (probe.videoCodec ?? "").toLowerCase();
  if (c === "h264" && (e === ".mp4" || e === ".mov" || e === ".m4v")) return false;
  if (c === "h264") return true;
  if (c === "hevc" || c === "h265" || c === "vp9" || c === "av1" || c === "mpeg4") return true;
  return false;
}

function runTranscodeToMp4(inputAbs: string, outputAbs: string, hasAudio: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const cmd = ffmpeg(inputAbs)
      .outputOptions([
        "-c:v libx264",
        "-preset veryfast",
        "-crf 23",
        "-pix_fmt yuv420p",
        "-movflags",
        "+faststart",
      ])
      .on("end", () => resolve())
      .on("error", (e) => reject(e));
    if (hasAudio) {
      cmd.outputOptions(["-c:a aac", "-b:a 160k"]);
    } else {
      cmd.outputOptions(["-an"]);
    }
    cmd.save(outputAbs);
  });
}

/**
 * After disk upload: probe, optionally transcode to MP4, enforce reel rules.
 */
export async function normalizeMediaAfterUpload(
  rel: string,
  cat: UploadCategory,
): Promise<{ rel: string; mediaType: "video" | "image"; converted: boolean }> {
  const abs = absFromRel(rel);
  const ext = path.extname(abs).toLowerCase();
  const stem = path.basename(abs, ext);
  const dir = path.dirname(abs);

  const shouldProbe =
    cat === "reels" ||
    (cat === "stories" && (VIDEO_EXTENSIONS.has(ext) || ext === ".heic" || ext === ".heif")) ||
    (cat === "posts" && (VIDEO_EXTENSIONS.has(ext) || ext === ".heic" || ext === ".heif"));

  if (!shouldProbe) {
    return {
      rel,
      mediaType: VIDEO_EXTENSIONS.has(ext) ? "video" : "image",
      converted: false,
    };
  }

  let probe: ProbeInfo;
  try {
    probe = await ffprobeFile(abs);
  } catch (e) {
    console.error("[videoNormalize] probe failed:", e);
    try {
      fs.unlinkSync(abs);
    } catch {
      /* ignore */
    }
    throw new Error("Could not read this media file. Try MP4 or MOV.");
  }

  if (cat === "reels" && !probe.hasVideoStream) {
    try {
      fs.unlinkSync(abs);
    } catch {
      /* ignore */
    }
    throw new Error("Reels need a video clip. This file looks like a still photo (HEIC/JPEG).");
  }

  if (!probe.hasVideoStream) {
    return { rel, mediaType: "image", converted: false };
  }

  if (!needsTranscodeToMp4(ext, probe)) {
    return { rel, mediaType: "video", converted: false };
  }

  const tmpOut = path.join(dir, `${stem}-bromoenc-${Date.now()}.mp4`);
  try {
    await runTranscodeToMp4(abs, tmpOut, probe.hasAudioStream);
  } catch (e) {
    console.error("[videoNormalize] transcode failed:", e);
    try {
      fs.unlinkSync(tmpOut);
    } catch {
      /* ignore */
    }
    try {
      fs.unlinkSync(abs);
    } catch {
      /* ignore */
    }
    throw new Error("Video conversion failed. Try a shorter clip or MP4/H.264.");
  }

  try {
    fs.unlinkSync(abs);
  } catch {
    /* ignore */
  }

  const finalAbs = path.join(dir, `${stem}.mp4`);
  try {
    if (fs.existsSync(finalAbs)) fs.unlinkSync(finalAbs);
  } catch {
    /* ignore */
  }
  fs.renameSync(tmpOut, finalAbs);

  const newRel = path.relative(UPLOAD_DIR, finalAbs).split(path.sep).join("/");
  return { rel: newRel, mediaType: "video", converted: true };
}
