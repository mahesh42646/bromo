/**
 * One-time platform purge: remove from MongoDB + disk:
 *   - **Video reels** (type=reel, mediaType=video)
 *   - **Video posts** (type=post, mediaType=video)
 *   - **Video stories** (type=story, mediaType=video)
 *
 * Preserves: image posts, image reels, image stories, chat media, avatars, /uploads/settings, etc.
 *
 * Run from `bromo-api/`:
 *   # Dry run (default): lists counts and sample paths
 *   npx tsx scripts/purge-video-posts-platform.ts
 *
 *   # Actually delete (requires explicit flag)
 *   PURGE_EXECUTE=1 npx tsx scripts/purge-video-posts-platform.ts
 *
 * Uses `MONGODB_URI` from `.env`. Does not start the HTTP server.
 */
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { env } from "../src/config/env.js";
import { Post } from "../src/models/Post.js";
import { Like } from "../src/models/Like.js";
import { Comment } from "../src/models/Comment.js";
import { User } from "../src/models/User.js";

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");

const EXECUTE = process.env.PURGE_EXECUTE === "1";

const PURGE_FILTER = {
  mediaType: "video" as const,
  type: { $in: ["reel", "post", "story"] as const },
};

/** Relative path inside `uploads/` (e.g. `abc.mp4`, `hls/foo/360p.m3u8`), or null if not our uploads URL. */
function uploadsRelativeFromUrl(raw: string | undefined | null): string | null {
  if (!raw?.trim()) return null;
  const s = raw.trim();
  let pathname = "";
  try {
    pathname = new URL(s).pathname;
  } catch {
    if (s.startsWith("/uploads/")) pathname = s;
    else return null;
  }
  const marker = "/uploads/";
  const i = pathname.indexOf(marker);
  if (i === -1) return null;
  let rel = pathname.slice(i + marker.length).replace(/^\/+/, "");
  if (!rel || rel.includes("..")) return null;
  // Never touch settings or other app areas
  if (rel.startsWith("settings/")) return null;
  return rel;
}

function absoluteUnderUploads(rel: string): string | null {
  const full = path.normalize(path.join(UPLOAD_DIR, rel));
  const root = path.normalize(UPLOAD_DIR + path.sep);
  if (!full.startsWith(root)) return null;
  return full;
}

function collectDiskTargets(mediaUrl: string, thumbnailUrl: string): { files: Set<string>; hlsDirs: Set<string> } {
  const files = new Set<string>();
  const hlsDirs = new Set<string>();
  for (const url of [mediaUrl, thumbnailUrl]) {
    const rel = uploadsRelativeFromUrl(url);
    if (!rel) continue;
    if (rel.startsWith("hls/")) {
      const seg = rel.split("/").filter(Boolean);
      if (seg.length >= 2) {
        const dir = absoluteUnderUploads(path.join("hls", seg[1]));
        if (dir) hlsDirs.add(dir);
      }
    } else {
      const abs = absoluteUnderUploads(rel);
      if (abs) files.add(abs);
    }
  }
  return { files, hlsDirs };
}

async function run() {
  await mongoose.connect(env.mongoUri);

  const posts = await Post.find(PURGE_FILTER).lean();
  const postIds = posts.map((p) => p._id);

  console.log(`[purge] matched posts: ${posts.length} (execute=${EXECUTE})`);
  if (posts.length === 0) {
    await mongoose.disconnect();
    return;
  }

  const byType: Record<string, number> = {};
  for (const p of posts) {
    const k = `${p.type}/${p.mediaType}`;
    byType[k] = (byType[k] ?? 0) + 1;
  }
  console.log("[purge] by type/media:", byType);

  const allFiles = new Set<string>();
  const allHls = new Set<string>();
  for (const p of posts) {
    const { files, hlsDirs } = collectDiskTargets(p.mediaUrl, p.thumbnailUrl ?? "");
    files.forEach((f) => allFiles.add(f));
    hlsDirs.forEach((d) => allHls.add(d));
  }
  console.log(`[purge] unique upload files to remove: ${allFiles.size}`);
  console.log(`[purge] unique hls dirs to remove: ${allHls.size}`);
  if (allFiles.size <= 20) {
    for (const f of allFiles) console.log("  file:", f);
  }
  if (allHls.size <= 20) {
    for (const d of allHls) console.log("  hls dir:", d);
  }

  if (!EXECUTE) {
    console.log("\n[purge] DRY RUN only. Set PURGE_EXECUTE=1 to apply DB + disk deletes.");
    await mongoose.disconnect();
    return;
  }

  const commentDocs = await Comment.find({ postId: { $in: postIds } }).select("_id").lean();
  const commentIds = commentDocs.map((c) => c._id);

  const likePost = await Like.deleteMany({ targetType: "post", targetId: { $in: postIds } });
  const likeComment =
    commentIds.length > 0
      ? await Like.deleteMany({ targetType: "comment", targetId: { $in: commentIds } })
      : { deletedCount: 0 };

  const delComments = await Comment.deleteMany({ postId: { $in: postIds } });
  console.log(`[purge] likes (post): ${likePost.deletedCount}, likes (comment): ${likeComment.deletedCount}, comments: ${delComments.deletedCount}`);

  // Decrement postsCount only for rows that were still active (soft-deleted already adjusted count)
  const activeByAuthor = new Map<string, number>();
  for (const p of posts) {
    if (!p.isActive) continue;
    const a = String(p.authorId);
    activeByAuthor.set(a, (activeByAuthor.get(a) ?? 0) + 1);
  }
  for (const [authorId, n] of activeByAuthor) {
    await User.updateOne({ _id: authorId }, { $inc: { postsCount: -n } });
  }
  await User.updateMany({ postsCount: { $lt: 0 } }, { $set: { postsCount: 0 } });

  for (const file of allFiles) {
    try {
      if (fs.existsSync(file) && fs.statSync(file).isFile()) {
        fs.unlinkSync(file);
        console.log("[purge] deleted file:", file);
      }
    } catch (e) {
      console.warn("[purge] file delete failed:", file, e);
    }
  }

  for (const dir of allHls) {
    try {
      if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
        fs.rmSync(dir, { recursive: true, force: true });
        console.log("[purge] deleted hls dir:", dir);
      }
    } catch (e) {
      console.warn("[purge] hls rm failed:", dir, e);
    }
  }

  const delPosts = await Post.deleteMany({ _id: { $in: postIds } });
  console.log(`[purge] posts removed from DB: ${delPosts.deletedCount}`);
  console.log("[purge] done.");

  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
