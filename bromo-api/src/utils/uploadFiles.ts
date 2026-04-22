import fs from "node:fs";
import path from "node:path";
import { getCdnBaseUrl } from "./publicMediaUrl.js";

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");

export type UploadCategory = "posts" | "reels" | "stories" | "profile" | "public";

export function uploadsRoot(): string {
  return UPLOAD_DIR;
}

/** Map client query / mobile param to disk folder name. */
export function normalizeUploadCategory(raw: string | undefined): UploadCategory {
  const v = (raw ?? "posts").toLowerCase().trim();
  if (v === "reel" || v === "reels") return "reels";
  if (v === "story" || v === "stories") return "stories";
  if (v === "post" || v === "posts") return "posts";
  if (v === "profile" || v === "avatar") return "profile";
  if (v === "public" || v === "chat" || v === "dm") return "public";
  return "posts";
}

/** Relative path under `uploads/` (POSIX slashes) from absolute file path. */
export function relativeUploadPathFromAbs(absFilePath: string): string {
  const rel = path.relative(UPLOAD_DIR, absFilePath);
  if (rel.startsWith("..")) {
    throw new Error("Invalid upload path");
  }
  return rel.split(path.sep).join("/");
}

export function publicUrlForUploadRelative(relativePosix: string): string {
  const base = getCdnBaseUrl();
  const clean = relativePosix.replace(/^\/+/, "");
  return `${base}/uploads/${clean}`;
}

/**
 * Parse stored media URL and return relative path under `uploads/`, or null.
 * Supports full URLs and paths starting with /uploads/
 */
export function uploadRelativePathFromUrl(mediaUrl: string): string | null {
  if (!mediaUrl?.trim()) return null;
  const u = mediaUrl.trim();
  try {
    const parsed = new URL(u);
    if (!parsed.pathname.startsWith("/uploads/")) return null;
    return parsed.pathname.replace(/^\/uploads\//, "").replace(/\/+/g, "/");
  } catch {
    if (u.startsWith("/uploads/")) {
      return u.slice("/uploads/".length).replace(/^\/+/, "");
    }
    return null;
  }
}

/** Delete a file under uploads/ if it exists. Safe against path traversal. */
export function safeUnlinkUploadRelative(relativePosix: string): void {
  if (!relativePosix || relativePosix.includes("..")) return;
  const abs = path.join(UPLOAD_DIR, ...relativePosix.split("/"));
  const resolved = path.resolve(abs);
  if (!resolved.startsWith(UPLOAD_DIR + path.sep) && resolved !== UPLOAD_DIR) {
    return;
  }
  if (fs.existsSync(resolved)) {
    try {
      fs.unlinkSync(resolved);
    } catch (e) {
      console.warn("[uploadFiles] unlink failed:", resolved, e);
    }
  }
}

export function deleteLocalFilesForMediaUrls(urls: (string | undefined | null)[]): void {
  const seen = new Set<string>();
  for (const url of urls) {
    const rel = uploadRelativePathFromUrl(url ?? "");
    if (!rel || seen.has(rel)) continue;
    seen.add(rel);
    safeUnlinkUploadRelative(rel);
  }
}
