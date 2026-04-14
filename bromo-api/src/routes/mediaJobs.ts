/**
 * GET /media/jobs/:id — poll async media job status.
 * Returns job status + HLS master URL when ready.
 */

import { Router, type Response } from "express";
import {
  requireFirebaseToken,
  type FirebaseAuthedRequest,
} from "../middleware/firebaseAuth.js";
import { MediaJob } from "../models/MediaJob.js";
import { Post } from "../models/Post.js";
import { publicUrlForUploadRelative } from "../utils/uploadFiles.js";

export const mediaJobsRouter = Router();

mediaJobsRouter.get(
  "/jobs/:id",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    const job = await MediaJob.findById(req.params.id).lean();
    if (!job) return res.status(404).json({ message: "Job not found" });

    // Security: only the owner can poll their job
    if (String(job.userId) !== String(req.dbUser?._id)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const hlsMasterUrl = job.hlsMasterRelPath
      ? publicUrlForUploadRelative(job.hlsMasterRelPath)
      : undefined;

    // Derive cellular-capped master URL from same HLS dir convention
    const cellMasterUrl = job.hlsMasterRelPath
      ? publicUrlForUploadRelative(job.hlsMasterRelPath.replace("master.m3u8", "master_cell.m3u8"))
      : undefined;

    let post: { _id: unknown; processingStatus?: string; hlsMasterUrl?: string } | null = null;
    if (job.postDraftId) {
      post = await Post.findById(job.postDraftId)
        .select("_id processingStatus hlsMasterUrl mediaUrl thumbnailUrl type mediaType caption")
        .lean();
    }

    return res.json({
      jobId: String(job._id),
      status: job.status,
      progress: job.progress,
      mediaType: job.mediaType,
      category: job.category,
      hlsMasterUrl,
      cellMasterUrl,
      renditions: job.renditions,
      error: job.error,
      postId: job.postDraftId ? String(job.postDraftId) : undefined,
      post,
      updatedAt: job.updatedAt,
    });
  },
);

/** GET /media/jobs — list caller's pending/processing jobs */
mediaJobsRouter.get(
  "/jobs",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    if (!req.dbUser) return res.status(401).json({ message: "Unauthorized" });

    const jobs = await MediaJob.find({
      userId: req.dbUser._id,
      status: { $in: ["queued", "processing"] },
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return res.json({ jobs: jobs.map((j) => ({
      jobId: String(j._id),
      status: j.status,
      progress: j.progress,
      mediaType: j.mediaType,
      category: j.category,
      postId: j.postDraftId ? String(j.postDraftId) : undefined,
      createdAt: j.createdAt,
    }))});
  },
);
