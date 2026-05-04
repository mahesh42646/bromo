import mongoose from "mongoose";
import { Post } from "../models/Post.js";
import { MusicTrack } from "../models/MusicTrack.js";

/**
 * When a video post uses a licensed catalog track with `audioRelPath`, queue server-side remux.
 * `videoRelPath` is POSIX relative under uploads (e.g. `users/x/file.mp4`).
 */
export async function enqueueLicensedAudioRemuxForPost(
  postId: mongoose.Types.ObjectId,
  videoRelPath: string,
): Promise<void> {
  const cleanPath = videoRelPath.replace(/^\/+/, "").replace(/^uploads\//, "");
  if (!cleanPath || cleanPath.includes("..")) return;

  const post = await Post.findById(postId).select("musicTrackId mediaType type").lean();
  if (!post?.musicTrackId || post.mediaType !== "video") return;
  if (post.type === "story") return;

  const track = await MusicTrack.findById(post.musicTrackId).select("license audioRelPath active").lean();
  if (!track || track.active === false || track.license !== "catalog" || !track.audioRelPath?.trim()) {
    return;
  }

  await Post.updateOne(
    { _id: postId },
    {
      $set: {
        originalVideoUrl: cleanPath,
        audioRemuxStatus: "pending",
        audioRemuxAttempts: 0,
        audioRemuxError: "",
      },
    },
  );
}
