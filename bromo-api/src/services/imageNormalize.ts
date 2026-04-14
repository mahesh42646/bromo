/**
 * Image normalization — resize to max height 1080, preserve aspect ratio, no upscale.
 * Uses FFmpeg (already bundled) to avoid native build deps.
 *
 * Supported: JPEG, PNG, WebP, HEIC/HEIF → JPEG output.
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

function absFromRel(rel: string): string {
  const clean = rel.replace(/^\/+/, "").split("/").join(path.sep);
  return path.join(UPLOAD_DIR, clean);
}

/** Probe image dimensions via ffmpeg -i stderr */
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

/** Returns true when the image needs resizing. */
function needsResize(width: number, height: number): boolean {
  return height > MAX_HEIGHT || width > MAX_WIDTH;
}

/** Scale filter: keep aspect ratio, fit within MAX_WIDTH×MAX_HEIGHT, divisible by 2. */
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
 * Normalize an image: resize to max 1080p height (no upscale), re-encode HEIC/HEIF to JPEG.
 * Returns updated relative path (may change extension for HEIC/HEIF).
 */
export async function normalizeImage(rel: string): Promise<string> {
  const abs = absFromRel(rel);
  const ext = path.extname(abs).toLowerCase();
  const stem = path.basename(abs, ext);
  const dir = path.dirname(abs);

  const isHeic = ext === ".heic" || ext === ".heif";

  let dims: { width: number; height: number };
  try {
    dims = probeImageDimensions(abs);
  } catch {
    // Can't probe — pass through unchanged
    return rel;
  }

  const shouldResize = needsResize(dims.width, dims.height);

  if (!isHeic && !shouldResize) {
    // Nothing to do — image is within limits and not HEIC
    return rel;
  }

  const outExt = ".jpg";
  const outAbs = path.join(dir, `${stem}-norm${outExt}`);
  const scaleFilter = buildScaleFilter(dims.width, dims.height);

  await new Promise<void>((resolve, reject) => {
    const cmd = ffmpeg(abs);
    if (scaleFilter) {
      cmd.outputOptions([`-vf ${scaleFilter}`]);
    }
    cmd
      .outputOptions([
        "-q:v 3",   // JPEG quality (1=best, 31=worst; 2-5 is excellent)
        "-frames:v 1",
        "-f image2",
      ])
      .on("end", () => resolve())
      .on("error", (e) => reject(e))
      .save(outAbs);
  });

  // Remove original if we produced a new file
  if (outAbs !== abs) {
    try {
      fs.unlinkSync(abs);
    } catch {
      /* ignore */
    }
  }

  return path.relative(UPLOAD_DIR, outAbs).split(path.sep).join("/");
}
