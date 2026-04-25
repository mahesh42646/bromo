/**
 * On user-initiated delete: copy originals to `trash/<stamp>_<postId>/...` then remove source keys.
 * Requires the same bucket + credentials as `s3Mirror` (S3_UPLOADS_BUCKET / S3_BUCKET).
 *
 * IAM (instance role or keys): `s3:ListBucket` on the bucket (prefix `uploads/` + `trash/`),
 * and `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject` on `arn:aws:s3:::BUCKET/uploads/*`
 * and `arn:aws:s3:::BUCKET/trash/*`.
 */

import {
  S3Client,
  CopyObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { isS3MirrorConfigured, objectKeyForRel } from "./s3Mirror.js";

const MIRROR_OFF = process.env.S3_MIRROR_ENABLED?.trim() === "0";

function bucket(): string | undefined {
  const b = process.env.S3_UPLOADS_BUCKET?.trim() || process.env.S3_BUCKET?.trim();
  return b || undefined;
}

let client: S3Client | null = null;

function s3(): S3Client | null {
  if (MIRROR_OFF || !bucket()) return null;
  if (!client) {
    client = new S3Client({
      region: process.env.AWS_REGION?.trim() || "us-east-1",
    });
  }
  return client;
}

function encodeCopySource(b: string, key: string): string {
  return `${b}/${encodeURIComponent(key).replace(/%2F/g, "/")}`;
}

async function listAllObjectKeys(prefix: string): Promise<string[]> {
  const c = s3();
  const b = bucket();
  if (!c || !b) return [];
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const out = await c.send(
      new ListObjectsV2Command({
        Bucket: b,
        Prefix: prefix,
        ContinuationToken: token,
      }),
    );
    for (const o of out.Contents ?? []) {
      if (o.Key) keys.push(o.Key);
    }
    token = out.IsTruncated ? out.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

/** Copy then delete a single object (best-effort). */
async function trashOneKey(sourceKey: string, trashBase: string, b: string, c: S3Client): Promise<void> {
  const destKey = `${trashBase}/${sourceKey}`;
  try {
    await c.send(
      new CopyObjectCommand({
        Bucket: b,
        Key: destKey,
        CopySource: encodeCopySource(b, sourceKey),
      }),
    );
  } catch (e) {
    console.warn("[s3Trash] copy failed:", sourceKey, e);
    return;
  }
  try {
    await c.send(new DeleteObjectCommand({ Bucket: b, Key: sourceKey }));
  } catch (e) {
    console.warn("[s3Trash] delete source failed:", sourceKey, e);
  }
}

/**
 * Move mirrored upload objects to trash prefix, then delete originals from the bucket.
 * `fileRels` are relative paths under `uploads/` (no `uploads/` prefix).
 * `dirRels` are directory paths under `uploads/` (e.g. `hls/jobId`) — all keys with that prefix are trashed.
 */
export async function trashMediaRelsOnS3(opts: {
  fileRels: string[];
  dirRels: string[];
  postId: string;
}): Promise<void> {
  if (!isS3MirrorConfigured()) return;
  const c = s3();
  const b = bucket();
  if (!c || !b) return;

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const trashBase = `trash/${stamp}_${opts.postId}`;

  const keys = new Set<string>();
  for (const rel of opts.fileRels) {
    keys.add(objectKeyForRel(rel));
  }
  for (const dir of opts.dirRels) {
    const prefix = objectKeyForRel(`${dir.replace(/\/+$/, "")}/`);
    const listed = await listAllObjectKeys(prefix);
    for (const k of listed) keys.add(k);
  }

  for (const sourceKey of keys) {
    await trashOneKey(sourceKey, trashBase, b, c);
  }
  console.info(`[s3Trash] moved ${keys.size} object(s) → ${trashBase}`);
}
