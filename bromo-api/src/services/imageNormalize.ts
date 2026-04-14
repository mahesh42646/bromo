/**
 * Image normalization — resize to max height 1080 / width 1920, preserve aspect, no upscale.
 * Output: **WebP** (lossy quality 85; alpha preserved for PNG/WebP sources).
 * Uses FFmpeg (already bundled).
 *
 * Supported inputs: JPEG, PNG, WebP, GIF (first frame), HEIC/HEIF, AVIF (if FFmpeg build supports decode).
 */

import ffmpeg from "fluent-ffmpeg";
import path from "node:path";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { bundledFfmpegPath } from "../config/ffmpegInit.js";
import { uploadsRoot } from "../utils/uploadFiles.js";

const UPLOAD_DIR = uploadsRoot();
const MAX_HEIGHT = 1080;
const MAX_WIDTH = 1920;
const WEBP_QUALITY = 85;

function absFromRel(rel: string): string {
  const clean = rel.replace(/^\/+/, "").split("/").join(path.sep);
  return path.join(UPLOAD_DIR, clean);
}

function probeImageDimensions(absPath: string): { width: number; height: number } {
  const bin = bundledFfmpegPath;
  if (!bin) throw new Error("ffmpeg binary not available");

  const r = spawnSync(bin, ["-hide_banner", "-i", absPath], {
    encoding: "utf-8",
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true,
  });
  const stderr = String(r.stderr ?? "");
  const m = stderr.match(/Stream.*Video:.*?,\s*(\d+)x(\d+)/);
  if (!m) throw new Error("Could not probe image dimensions");
  return { width: Number(m[1]), height: Number(m[2]) };
}

function needsResize(width: number, height: number): boolean {
  return height > MAX_HEIGHT || width > MAX_WIDTH;
}

function buildScaleFilter(width: number, height: number): string {
  if (height > MAX_HEIGHT) {
    return `scale=-2:${MAX_HEIGHT}`;
  }
  if (width > MAX_WIDTH) {
    return `scale=${MAX_WIDTH}:-2`;
  }
  return "";
}

/**
 * Normalize an image to WebP under max dimensions (no upscale).
 * HEIC/HEIF, GIF, and oversize assets are re-encoded; within bounds still converted to WebP for uniform delivery.
 */
export async function normalizeImage(rel: string): Promise<string> {
  const abs = absFromRel(rel);
  const ext = path.extname(abs).toLowerCase();
  const stem = path.basename(abs, ext);
  const dir = path.dirname(abs);

  const outAbs = path.join(dir, `${stem}-norm.webp`);

  let scaleFilter: string;
  try {
    const dims = probeImageDimensions(abs);
    scaleFilter = buildScaleFilter(dims.width, dims.height);
  } catch {
    scaleFilter = "";
  }

  await new Promise<void>((resolve, reject) => {
    const cmd = ffmpeg(abs);
    const vfParts: string[] = [];
    if (scaleFilter) vfParts.push(scaleFilter);
    if (ext === ".gif") {
      vfParts.push("format=rgba");
    }
    if (vfParts.length) {
      cmd.outputOptions([`-vf ${vfParts.join(",")}`]);
    }
    cmd
      .outputOptions([
        "-frames:v",
        "1",
        "-c:v",
        "libwebp",
        "-quality",
        String(WEBP_QUALITY),
        "-compression_level",
        "6",
      ])
      .on("end", () => resolve())
      .on("error", (e) => reject(e))
      .save(outAbs);
  });

  if (outAbs !== abs) {
    try {
      fs.unlinkSync(abs);
    } catch {
      /* ignore */
    }
  }

  return path.relative(UPLOAD_DIR, outAbs).split(path.sep).join("/");
}
