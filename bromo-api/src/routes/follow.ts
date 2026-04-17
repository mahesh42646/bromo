import { Router, type Response } from "express";
import mongoose from "mongoose";
import {
  requireFirebaseToken,
  requireVerifiedUser,
  type FirebaseAuthedRequest,
} from "../middleware/firebaseAuth.js";
import { Follow } from "../models/Follow.js";
import { User } from "../models/User.js";
import { createNotification, checkFollowerMilestone } from "../models/Notification.js";

export const followRouter = Router();

const USER_SELECT = "username displayName profilePicture followersCount followingCount postsCount isPrivate emailVerified";

// ── GET /users/suggestions ───────────────────────────────────────────
followRouter.get(
  "/suggestions",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const dbUser = req.dbUser;
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 20);

      let excludeIds: mongoose.Types.ObjectId[] = [];
      if (dbUser) {
        const follows = await Follow.find({ followerId: dbUser._id }).select("followingId");
        excludeIds = [dbUser._id, ...follows.map((f) => f.followingId)];
      }

      const query = excludeIds.length
        ? { _id: { $nin: excludeIds }, isActive: true, onboardingComplete: true }
        : { isActive: true, onboardingComplete: true };

      const users = await User.find(query)
        .select(USER_SELECT)
        .sort({ followersCount: -1 })
        .limit(limit)
        .lean();

      return res.json({
        users: users.map(u => ({
          ...u,
          followersCount: u.followersCount ?? 0,
          followingCount: u.followingCount ?? 0,
          postsCount: u.postsCount ?? 0,
        })),
      });
    } catch (err) {
      console.error("[follow] suggestions error:", err);
      return res.status(500).json({ message: "Failed to get suggestions" });
    }
  },
);

// ── GET /users/search?q= ─────────────────────────────────────────────
followRouter.get(
  "/search",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const q = ((req.query.q as string) ?? "").trim();
      if (!q) return res.json({ users: [] });

      const regex = new RegExp(q, "i");
      const dbUser = req.dbUser;
      const excludeSelf = dbUser ? { _id: { $ne: dbUser._id } } : {};
      const users = await User.find({
        ...excludeSelf,
        isActive: true,
        onboardingComplete: true,
        $or: [{ username: regex }, { displayName: regex }],
      })
        .select(USER_SELECT)
        .limit(20)
        .lean();

      let followingSet = new Set<string>();
      if (dbUser) {
        const follows = await Follow.find({
          followerId: dbUser._id,
          followingId: { $in: users.map((u) => u._id) },
        }).select("followingId status");
        follows.forEach((f) => followingSet.add(`${String(f.followingId)}:${f.status}`));
      }

      const result = users.map((u) => ({
        _id: u._id,
        username: u.username,
        displayName: u.displayName,
        profilePicture: u.profilePicture,
        followersCount: u.followersCount ?? 0,
        followingCount: u.followingCount ?? 0,
        postsCount: u.postsCount ?? 0,
        isPrivate: u.isPrivate,
        emailVerified: u.emailVerified,
        followStatus: followingSet.has(`${String(u._id)}:accepted`)
          ? "following"
          : followingSet.has(`${String(u._id)}:pending`)
          ? "requested"
          : "none",
      }));

      return res.json({ users: result });
    } catch (err) {
      console.error("[follow] search error:", err);
      return res.status(500).json({ message: "Search failed" });
    }
  },
);

// ── GET /users/:userId/profile ──────────────────────────────────────
followRouter.get(
  "/:userId/profile",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const dbUser = req.dbUser;
      const target = await User.findById(req.params.userId)
        .select(USER_SELECT + " bio website email createdAt")
        .lean();
      if (!target) return res.status(404).json({ message: "User not found" });

      let followStatus: "none" | "following" | "requested" = "none";
      if (dbUser) {
        const follow = await Follow.findOne({
          followerId: dbUser._id,
          followingId: target._id,
        });
        if (follow) {
          followStatus = follow.status === "accepted" ? "following" : "requested";
        }
      }

      return res.json({ user: { ...target, followStatus } });
    } catch (err) {
      console.error("[follow] profile error:", err);
      return res.status(500).json({ message: "Failed to get profile" });
    }
  },
);

// ── GET /users/:userId/followers ────────────────────────────────────
followRouter.get(
  "/:userId/followers",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const skip = (page - 1) * 30;

      const follows = await Follow.find({
        followingId: req.params.userId,
        status: "accepted",
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(30)
        .populate("followerId", USER_SELECT)
        .lean();

      return res.json({
        users: follows.map((f) => f.followerId),
        page,
        hasMore: follows.length === 30,
      });
    } catch (err) {
      console.error("[follow] followers error:", err);
      return res.status(500).json({ message: "Failed to get followers" });
    }
  },
);

// ── GET /users/:userId/following ────────────────────────────────────
followRouter.get(
  "/:userId/following",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const skip = (page - 1) * 30;

      const follows = await Follow.find({
        followerId: req.params.userId,
        status: "accepted",
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(30)
        .populate("followingId", USER_SELECT)
        .lean();

      return res.json({
        users: follows.map((f) => f.followingId),
        page,
        hasMore: follows.length === 30,
      });
    } catch (err) {
      console.error("[follow] following error:", err);
      return res.status(500).json({ message: "Failed to get following" });
    }
  },
);

// ── GET /users/follow-requests ──────────────────────────────────────
followRouter.get(
  "/follow-requests",
  requireVerifiedUser,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const user = req.dbUser!;
      const requests = await Follow.find({
        followingId: user._id,
        status: "pending",
      })
        .sort({ createdAt: -1 })
        .populate("followerId", USER_SELECT)
        .lean();

      return res.json({ requests: requests.map((r) => ({ ...r, from: r.followerId })) });
    } catch (err) {
      console.error("[follow] requests error:", err);
      return res.status(500).json({ message: "Failed to get requests" });
    }
  },
);

// ── POST /users/:userId/follow ──────────────────────────────────────
followRouter.post(
  "/:userId/follow",
  requireVerifiedUser,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const follower = req.dbUser!;
      const targetId = String(req.params.userId);

      if (String(follower._id) === targetId) {
        return res.status(400).json({ message: "Cannot follow yourself" });
      }

      const target = await User.findById(targetId);
      if (!target) return res.status(404).json({ message: "User not found" });

      const existing = await Follow.findOne({ followerId: follower._id, followingId: targetId });
      if (existing) {
        return res.json({ status: existing.status });
      }

      const status = target.isPrivate ? "pending" : "accepted";
      await Follow.create({ followerId: follower._id, followingId: targetId, status });

      if (status === "accepted") {
        const [, updatedTarget] = await Promise.all([
          User.findByIdAndUpdate(follower._id, { $inc: { followingCount: 1 } }),
          User.findByIdAndUpdate(targetId, { $inc: { followersCount: 1 } }, { new: true }),
        ]);
        // Persist follow notification
        createNotification({
          recipientId: targetId,
          actorId: follower._id,
          type: "follow",
          message: `${follower.displayName} started following you`,
        });
        // Milestone check
        if (updatedTarget) {
          checkFollowerMilestone(targetId, updatedTarget.followersCount ?? 0);
        }
      } else {
        // pending request notification
        createNotification({
          recipientId: targetId,
          actorId: follower._id,
          type: "follow_request",
          message: `${follower.displayName} requested to follow you`,
        });
      }

      return res.json({ status });
    } catch (err) {
      console.error("[follow] follow error:", err);
      return res.status(500).json({ message: "Failed to follow" });
    }
  },
);

// ── DELETE /users/:userId/follow ────────────────────────────────────
followRouter.delete(
  "/:userId/follow",
  requireVerifiedUser,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const follower = req.dbUser!;
      const targetId = String(req.params.userId);

      const follow = await Follow.findOne({ followerId: follower._id, followingId: targetId });
      if (!follow) return res.status(404).json({ message: "Not following" });

      const wasAccepted = follow.status === "accepted";
      await follow.deleteOne();

      if (wasAccepted) {
        await Promise.all([
          User.findByIdAndUpdate(follower._id, { $inc: { followingCount: -1 } }),
          User.findByIdAndUpdate(targetId, { $inc: { followersCount: -1 } }),
        ]);
      }

      return res.json({ unfollowed: true });
    } catch (err) {
      console.error("[follow] unfollow error:", err);
      return res.status(500).json({ message: "Failed to unfollow" });
    }
  },
);

// ── PATCH /users/follow-request/:requestId/accept ──────────────────
followRouter.patch(
  "/follow-request/:requestId/accept",
  requireVerifiedUser,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const user = req.dbUser!;
      const follow = await Follow.findById(req.params.requestId);
      if (!follow) return res.status(404).json({ message: "Request not found" });
      if (String(follow.followingId) !== String(user._id)) {
        return res.status(403).json({ message: "Not authorized" });
      }

      follow.status = "accepted";
      await follow.save();

      const [, updatedMe] = await Promise.all([
        User.findByIdAndUpdate(follow.followerId, { $inc: { followingCount: 1 } }),
        User.findByIdAndUpdate(user._id, { $inc: { followersCount: 1 } }, { new: true }),
      ]);
      // Notify the requester that their request was accepted
      createNotification({
        recipientId: follow.followerId,
        actorId: user._id,
        type: "follow_accept",
        message: `${user.displayName} accepted your follow request`,
      });
      if (updatedMe) checkFollowerMilestone(String(user._id), updatedMe.followersCount ?? 0);

      return res.json({ accepted: true });
    } catch (err) {
      console.error("[follow] accept error:", err);
      return res.status(500).json({ message: "Failed to accept request" });
    }
  },
);

// ── DELETE /users/follow-request/:requestId ─────────────────────────
followRouter.delete(
  "/follow-request/:requestId",
  requireVerifiedUser,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const user = req.dbUser!;
      const follow = await Follow.findById(req.params.requestId);
      if (!follow) return res.status(404).json({ message: "Request not found" });
      if (String(follow.followingId) !== String(user._id)) {
        return res.status(403).json({ message: "Not authorized" });
      }
      await follow.deleteOne();
      return res.json({ rejected: true });
    } catch (err) {
      console.error("[follow] reject error:", err);
      return res.status(500).json({ message: "Failed to reject request" });
    }
  },
);
