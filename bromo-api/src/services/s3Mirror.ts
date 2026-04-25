/**
 * Optional mirror: after FFmpeg writes under ./uploads, copy bytes to S3 so CloudFront
 * can origin-fetch from the bucket (or S3 public website / OAI).
 *
 * Env:
 *   S3_UPLOADS_BUCKET (or S3_BUCKET) — required
 *   AWS_REGION — default us-east-1
 *   S3_KEY_PREFIX — optional key prefix before `uploads/...` (usually empty)
 *   S3_MIRROR_ENABLED — set "0" to disable without removing bucket name
 *
 * IAM (EC2 instance role recommended): s3:PutObject on arn:aws:s3:::bucket/uploads/*
 *
 * CloudFront: origin = S3 bucket; behaviors for /uploads/*; cache TTLs long for segments.
 * Set CDN_BASE_URL=https://your-distribution.cloudfront.net and the API will emit CDN URLs.
 */

import { createReadStream } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { S3Client, PutObjectCommand, type PutObjectCommandInput } from "@aws-sdk/client-s3";
import { uploadsRoot } from "../utils/uploadFiles.js";

const MIRROR_OFF = process.env.S3_MIRROR_ENABLED?.trim() === "0";

function bucket(): string | undefined {
  const b = process.env.S3_UPLOADS_BUCKET?.trim() || process.env.S3_BUCKET?.trim();
  return b || undefined;
}

function keyPrefix(): string {
  return (process.env.S3_KEY_PREFIX ?? "").replace(/^\/+|\/+$/g, "");
}

let client: S3Client | null = null;

function s3Client(): S3Client | null {
  if (MIRROR_OFF || !bucket()) return null;
  if (!client) {
    client = new S3Client({
      region: process.env.AWS_REGION?.trim() || "us-east-1",
    });
  }
  return client;
}

function contentTypeAndCache(absPath: string): { contentType: string; cacheControl: string } {
  const ext = path.extname(absPath).toLowerCase();
  const isHlsDir = absPath.includes(`${path.sep}hls${path.sep}`);
  const ct =
    ext === ".m3u8"
      ? "application/vnd.apple.mpegurl"
      : ext === ".m4s"
        ? "video/iso.segment"
        : ext === ".ts"
          ? "video/mp2t"
          : ext === ".mp4" || ext === ".m4v"
            ? "video/mp4"
            : ext === ".webm"
              ? "video/webm"
              : ext === ".mov"
                ? "video/quicktime"
                : ext === ".jpg" || ext === ".jpeg"
                  ? "image/jpeg"
                  : ext === ".png"
                    ? "image/png"
                    : ext === ".webp"
                      ? "image/webp"
                      : ext === ".gif"
                        ? "image/gif"
                        : "application/octet-stream";

  if (isHlsDir && (ext === ".m4s" || ext === ".ts")) {
    return { contentType: ct, cacheControl: "public, max-age=31536000, immutable" };
  }
  if (isHlsDir && ext === ".m3u8") {
    return { contentType: ct, cacheControl: "public, max-age=86400, immutable" };
  }
  if (/\/profile\//i.test(absPath.replace(/\\/g, "/"))) {
    return { contentType: ct, cacheControl: "public, max-age=31536000, immutable" };
  }
  if ([".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)) {
    return { contentType: ct, cacheControl: "public, max-age=604800" };
  }
  if ([".mp4", ".mov", ".webm", ".m4v"].includes(ext)) {
    return { contentType: ct, cacheControl: "public, max-age=604800" };
  }
  return { contentType: ct, cacheControl: "public, max-age=3600" };
}

/** S3 object key for a file under `uploads/<relPosix>` (includes optional `S3_KEY_PREFIX`). */
export function objectKeyForRel(relPosix: string): string {
  const clean = relPosix.replace(/^\/+/, "");
  const p = keyPrefix();
  return p ? `${p}/uploads/${clean}` : `uploads/${clean}`;
}

export function isS3MirrorConfigured(): boolean {
  return !MIRROR_OFF && Boolean(bucket() && s3Client());
}

export async function mirrorUploadRelative(relPosix: string): Promise<void> {
  const c = s3Client();
  const b = bucket();
  if (!c || !b) return;
  if (!relPosix || relPosix.includes("..")) return;
  const abs = path.join(uploadsRoot(), ...relPosix.split("/"));
  const resolved = path.resolve(abs);
  const root = path.resolve(uploadsRoot());
  if (!resolved.startsWith(root + path.sep) && resolved !== root) return;
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) return;

  const Key = objectKeyForRel(relPosix);
  const { contentType, cacheControl } = contentTypeAndCache(resolved);
  const input: PutObjectCommandInput = {
    Bucket: b,
    Key,
    Body: createReadStream(resolved),
    ContentType: contentType,
    CacheControl: cacheControl,
  };
  await c.send(new PutObjectCommand(input));
}

function listFilesRecursive(dirAbs: string, out: string[]): void {
  const entries = fs.readdirSync(dirAbs, { withFileTypes: true });
  for (const ent of entries) {
    const p = path.join(dirAbs, ent.name);
    if (ent.isDirectory()) listFilesRecursive(p, out);
    else if (ent.isFile()) out.push(p);
  }
}

/** Mirror every file under uploads/<dirRel> (e.g. hls/jobId). */
export async function mirrorUploadTreeRelative(dirRelPosix: string): Promise<void> {
  const c = s3Client();
  const b = bucket();
  if (!c || !b) return;
  if (!dirRelPosix || dirRelPosix.includes("..")) return;
  const absDir = path.join(uploadsRoot(), ...dirRelPosix.split("/"));
  const resolvedDir = path.resolve(absDir);
  const root = path.resolve(uploadsRoot());
  if (!resolvedDir.startsWith(root + path.sep)) return;
  if (!fs.existsSync(resolvedDir) || !fs.statSync(resolvedDir).isDirectory()) return;

  const files: string[] = [];
  listFilesRecursive(resolvedDir, files);
  const concurrency = Math.min(8, Math.max(1, parseInt(process.env.S3_MIRROR_CONCURRENCY ?? "4", 10) || 4));
  for (let off = 0; off < files.length; off += concurrency) {
    const slice = files.slice(off, off + concurrency);
    await Promise.all(
      slice.map(async (abs) => {
        const rel = path.relative(root, abs).split(path.sep).join("/");
        try {
          await mirrorUploadRelative(rel);
        } catch (e) {
          console.warn("[s3Mirror] file failed:", rel, e);
        }
      }),
    );
  }
  console.info(`[s3Mirror] tree ${dirRelPosix} → ${files.length} objects`);
}
