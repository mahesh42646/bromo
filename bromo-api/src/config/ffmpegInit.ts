import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";

/** Path to bundled ffmpeg (ffmpeg-static), or null if unsupported platform. */
export const bundledFfmpegPath: string | null =
  typeof ffmpegStatic === "string" ? ffmpegStatic : null;

if (bundledFfmpegPath) {
  ffmpeg.setFfmpegPath(bundledFfmpegPath);
}
