import fs from "node:fs";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";

function firstExisting(paths: Array<string | null | undefined>): string | null {
  for (const p of paths) {
    if (typeof p === "string" && p.trim() && fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

/**
 * Prefer `FFMPEG_PATH`, then bundled ffmpeg-static if present on disk,
 * then common system paths. Avoids ENOENT when pnpm paths differ on deploy
 * or the static binary wasn't unpacked for the server OS.
 */
export const bundledFfmpegPath: string | null = firstExisting([
  process.env.FFMPEG_PATH?.trim(),
  typeof ffmpegStatic === "string" ? ffmpegStatic : null,
  "/usr/bin/ffmpeg",
  "/usr/local/bin/ffmpeg",
]);

if (bundledFfmpegPath) {
  ffmpeg.setFfmpegPath(bundledFfmpegPath);
}

/** `fluent-ffmpeg` ffprobe calls need ffprobe on PATH or an explicit path (not the ffmpeg-static bundle). */
const ffprobeResolved = firstExisting([
  process.env.FFPROBE_PATH?.trim(),
  "/usr/bin/ffprobe",
  "/usr/local/bin/ffprobe",
]);
if (ffprobeResolved) {
  ffmpeg.setFfprobePath(ffprobeResolved);
}
