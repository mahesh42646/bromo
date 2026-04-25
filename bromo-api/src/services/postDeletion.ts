import path from "node:path";
import mongoose from "mongoose";
import type { PostDoc } from "../models/Post.js";
import { Comment } from "../models/Comment.js";
import { Like } from "../models/Like.js";
import { PostPollVote } from "../models/PostPollVote.js";
import { MediaJob } from "../models/MediaJob.js";
import { User } from "../models/User.js";
import { Post } from "../models/Post.js";
import {
  deleteLocalFilesForMediaUrls,
  publicUrlForUploadRelative,
  uploadRelativePathFromUrl,
  safeRmDirUploadRelative,
} from "../utils/uploadFiles.js";
import { rewritePublicMediaUrl } from "../utils/publicMediaUrl.js";
import { authorPostsCountWasBumped } from "../utils/authorPostsCount.js";
import { emitPostDelete, emitStoryDelete } from "./socketService.js";
import { trashMediaRelsOnS3 } from "./s3Trash.js";

function isUnderDir(fileRel: string, dirRel: string): boolean {
  const d = dirRel.replace(/\/+$/, "");
  return fileRel === d || fileRel.startsWith(d + "/");
}

function collectMediaRels(post: PostDoc): { fileRels: string[]; dirRels: string[] } {
  const files = new Set<string>();
  const addUrl = (u?: string | null) => {
    const rw = typeof u === "string" && u.trim() ? rewritePublicMediaUrl(u.trim()) : "";
    const rel = uploadRelativePathFromUrl(rw);
    if (rel) files.add(rel);
  };
  addUrl(post.mediaUrl);
  addUrl(post.thumbnailUrl);
  const hlsRw =
    typeof post.hlsMasterUrl === "string" && post.hlsMasterUrl.trim()
      ? rewritePublicMediaUrl(post.hlsMasterUrl.trim())
      : "";
  const hlsRel = uploadRelativePathFromUrl(hlsRw);
  const dirs = new Set<string>();
  if (hlsRel) {
    const dir = path.posix.dirname(hlsRel);
    if (dir && dir !== "." && dir !== "/") dirs.add(dir);
  }
  const dirRels = [...dirs];
  const fileRels = [...files].filter((f) => !dirRels.some((d) => isUnderDir(f, d)));
  return { fileRels, dirRels };
}

/**
 * Hard-delete a post: trash mirrored S3 objects, remove local uploads, DB row, and dependents.
 */
export async function hardDeletePostWithTrash(post: PostDoc): Promise<void> {
  const { fileRels, dirRels } = collectMediaRels(post);
  const postId = String(post._id);
  const authorId = String(post.authorId);
  const typ = String(post.type ?? "post");

  await trashMediaRelsOnS3({ fileRels, dirRels, postId });

  for (const d of dirRels) {
    safeRmDirUploadRelative(d);
  }
  deleteLocalFilesForMediaUrls(fileRels.map((r) => publicUrlForUploadRelative(r)));

  await Promise.all([
    Comment.updateMany({ postId: post._id }, { $set: { isActive: false } }),
    Like.deleteMany({ targetType: "post", targetId: post._id }),
    PostPollVote.deleteMany({ postId: post._id }),
    MediaJob.deleteMany({ postDraftId: post._id }),
  ]);

  const savedCol = mongoose.connection.collection("saved_posts");
  await savedCol.deleteMany({ postId: post._id }).catch(() => null);

  const shouldDecrementGridCount =
    !post.isDeleted && Boolean(post.isActive) && authorPostsCountWasBumped(post);
  if (shouldDecrementGridCount) {
    await User.findByIdAndUpdate(post.authorId, { $inc: { postsCount: -1 } }).catch(() => null);
  }

  await Post.deleteOne({ _id: post._id });

  emitPostDelete(postId, { authorId, type: typ });
  if (typ === "story") {
    emitStoryDelete(authorId, postId);
  }
}
