import type { ProcessingStatus } from "../models/Post.js";

/**
 * Whether this post already incremented the author's `User.postsCount`.
 * Async drafts (pending/processing/failed) are not counted until `ready`.
 * Legacy sync posts have no `mediaJobId` and no pipeline status.
 */
export function authorPostsCountWasBumped(post: {
  processingStatus?: ProcessingStatus;
  mediaJobId?: unknown;
}): boolean {
  if (post.processingStatus === "ready") return true;
  if (
    post.processingStatus === "pending" ||
    post.processingStatus === "processing" ||
    post.processingStatus === "failed"
  ) {
    return false;
  }
  if (post.mediaJobId) return false;
  return true;
}
