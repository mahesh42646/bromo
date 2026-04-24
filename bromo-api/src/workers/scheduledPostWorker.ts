import {Post} from "../models/Post.js";
import {User} from "../models/User.js";

const STORY_WINDOW_MS = 24 * 60 * 60 * 1000;
let started = false;

async function activateDueScheduledPosts(): Promise<void> {
  const now = new Date();
  const due = await Post.find({
    scheduledFor: {$lte: now},
    isActive: false,
    isDeleted: {$ne: true},
    processingStatus: {$nin: ["pending", "processing", "failed"]},
  })
    .select("_id authorId type expiresAt")
    .lean();

  if (!due.length) return;

  const postOps = due.map((post) => ({
    updateOne: {
      filter: {_id: post._id, isActive: false},
      update: {
        $set: {
          isActive: true,
          ...(post.type === "story" && !post.expiresAt
            ? {expiresAt: new Date(Date.now() + STORY_WINDOW_MS)}
            : {}),
        },
      },
    },
  }));
  await Post.bulkWrite(postOps, {ordered: false});

  const countByAuthor = new Map<string, number>();
  for (const post of due) {
    if (post.type !== "post" && post.type !== "reel") continue;
    const key = String(post.authorId);
    countByAuthor.set(key, (countByAuthor.get(key) ?? 0) + 1);
  }
  if (countByAuthor.size > 0) {
    await User.bulkWrite(
      [...countByAuthor.entries()].map(([authorId, count]) => ({
        updateOne: {
          filter: {_id: authorId},
          update: {$inc: {postsCount: count}},
        },
      })),
      {ordered: false},
    );
  }
}

export function startScheduledPostWorker(): void {
  if (started) return;
  started = true;
  void activateDueScheduledPosts().catch((err) => {
    console.error("[scheduledPosts] initial activation failed:", err);
  });
  const timer = setInterval(() => {
    void activateDueScheduledPosts().catch((err) => {
      console.error("[scheduledPosts] tick failed:", err);
    });
  }, 30_000);
  timer.unref();
}
