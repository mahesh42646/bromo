import path from "node:path";
import type { UploadCategory } from "./uploadFiles.js";

/**
 * Input matrix (server normalizes after upload):
 * - Images: jpg/jpeg/png/webp/gif/heic/heif/avif → WebP (GIF = first frame) via imageNormalize + sync path.
 * - Video: mp4/mov/m4v/webm/mkv/avi/mpeg/mpg/3gp → HLS ladder + mezzanine MP4 (async) or probe/transcode (sync).
 * - HEIC with video/quicktime MIME: extension wins → image pipeline (see media routes).
 */

/** Extensions we never store (scripts, HTML, binaries). */
export const BLOCKED_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".php",
  ".phtml",
  ".asp",
  ".aspx",
  ".jsp",
  ".html",
  ".htm",
  ".svg",
  ".wasm",
  ".exe",
  ".dll",
  ".sh",
  ".bash",
  ".bat",
  ".cmd",
  ".ps1",
  ".pl",
  ".py",
  ".rb",
  ".htaccess",
]);

export const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".heic",
  ".heif",
  ".avif",
]);

export const VIDEO_EXTENSIONS = new Set([
  ".mp4",
  ".mov",
  ".m4v",
  ".3gp",
  ".webm",
  ".mkv",
  ".avi",
  ".mpeg",
  ".mpg",
]);

export const AUDIO_EXTENSIONS = new Set([".aac", ".m4a"]);

export function normalizedMime(mime: string): string {
  return mime.split(";")[0]?.trim().toLowerCase() ?? "";
}

export function extFromOriginalName(originalname: string): string {
  return path.extname(originalname).toLowerCase();
}

export function isBlockedExtension(ext: string): boolean {
  if (!ext) return false;
  const e = ext.startsWith(".") ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
  return BLOCKED_EXTENSIONS.has(e);
}

export function isVideoLike(mimetype: string, ext: string): boolean {
  // Image extensions always win — HEIC files sent as video/quicktime must never be video.
  if (IMAGE_EXTENSIONS.has(ext)) return false;
  if (VIDEO_EXTENSIONS.has(ext)) return true;
  return normalizedMime(mimetype).startsWith("video/");
}

export function isImageLike(mimetype: string, ext: string): boolean {
  if (IMAGE_EXTENSIONS.has(ext)) return true;
  const m = normalizedMime(mimetype);
  return m.startsWith("image/");
}

export function isAudioLike(mimetype: string, ext: string): boolean {
  if (AUDIO_EXTENSIONS.has(ext)) return true;
  return normalizedMime(mimetype).startsWith("audio/");
}

/**
 * Returns an error message if this file must be rejected for the upload bucket, else null.
 */
export function validateUploadForCategory(
  category: UploadCategory,
  mimetype: string,
  originalname: string,
): string | null {
  const ext = extFromOriginalName(originalname);
  if (isBlockedExtension(ext)) {
    return "This file type is not allowed for security reasons.";
  }

  if (category === "reels") {
    // Allow images (HEIC) and videos — server probes and converts true video to MP4; still photos are rejected there.
    if (isImageLike(mimetype, ext) || isVideoLike(mimetype, ext)) {
      return null;
    }
    return "Reels accept photos (HEIC/JPEG/…) or video (MP4/MOV/…). Unsupported type.";
  }

  if (category === "profile") {
    if (!isImageLike(mimetype, ext)) {
      return "Profile photos must be an image (JPEG, PNG, HEIC, WebP, …).";
    }
    return null;
  }

  if (category === "public") {
    if (isVideoLike(mimetype, ext) || isImageLike(mimetype, ext) || isAudioLike(mimetype, ext)) {
      return null;
    }
    return "Chat uploads must be an image, video, or audio clip.";
  }

  // posts, stories — images or videos (no raw audio for grid posts)
  if (category === "posts" || category === "stories") {
    if (isVideoLike(mimetype, ext) || isImageLike(mimetype, ext)) {
      return null;
    }
    return "Posts and stories accept images or videos only.";
  }

  return null;
}
