import { Router, type Response } from "express";
import mongoose from "mongoose";
import {
  requireFirebaseToken,
  requireVerifiedUser,
  type FirebaseAuthedRequest,
} from "../middleware/firebaseAuth.js";
import { Follow } from "../models/Follow.js";
import { Like } from "../models/Like.js";
import { Post } from "../models/Post.js";
import { User } from "../models/User.js";
import { createNotification, checkFollowerMilestone } from "../models/Notification.js";
import { emitNotification } from "../services/socketService.js";

export const followRouter = Router();

const USER_SELECT =
  "username displayName profilePicture followersCount followingCount postsCount isPrivate emailVerified isVerified verificationStatus creatorBadge creatorStatus interests";
const SELF_USER_SELECT = `${USER_SELECT} email phone`;
const PROFILE_SELECT = "bio website createdAt isVerified verificationStatus isCreator creatorStatus creatorBadge connectedStore";

type FollowStatus = "none" | "following" | "requested";
type RelationPayload = { iFollow: boolean; followsMe: boolean; isMe: boolean; chatId?: string };
type PublicUserRow = {
  _id: mongoose.Types.ObjectId;
  username?: string;
  displayName?: string;
  profilePicture?: string;
  followersCount?: number;
  followingCount?: number;
  postsCount?: number;
  isPrivate?: boolean;
  emailVerified?: boolean;
  isVerified?: boolean;
  verificationStatus?: string;
  creatorBadge?: boolean;
  creatorStatus?: string;
  interests?: string[];
};

function toObjectIds(values: unknown[]): mongoose.Types.ObjectId[] {
  return values
    .map((value) => {
      const raw = value != null ? String(value) : "";
      return mongoose.Types.ObjectId.isValid(raw) ? new mongoose.Types.ObjectId(raw) : null;
    })
    .filter((id): id is mongoose.Types.ObjectId => id != null);
}

function normalizeInterest(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function isPublicUserRow(value: unknown): value is PublicUserRow {
  return typeof value === "object" && value !== null && "_id" in value;
}

function serializeUserRow(
  user: PublicUserRow,
  relation?: RelationPayload,
  followStatus: FollowStatus = "none",
) {
  return {
    ...user,
    followersCount: user.followersCount ?? 0,
    followingCount: user.followingCount ?? 0,
    postsCount: user.postsCount ?? 0,
    relation,
    followStatus,
  };
}

async function relationMapsFor(dbUser: FirebaseAuthedRequest["dbUser"], userIds: mongoose.Types.ObjectId[]) {
  const relationByUserId = new Map<string, RelationPayload>();
  const statusByUserId = new Map<string, FollowStatus>();
  const uniqueIds = [...new Map(userIds.map((id) => [String(id), id])).values()];

  if (!dbUser || uniqueIds.length === 0) {
    uniqueIds.forEach((id) => {
      relationByUserId.set(String(id), { iFollow: false, followsMe: false, isMe: false });
      statusByUserId.set(String(id), "none");
    });
    return { relationByUserId, statusByUserId };
  }

  const [iFollowRows, followsMeRows] = await Promise.all([
    Follow.find({ followerId: dbUser._id, followingId: { $in: uniqueIds } })
      .select("followingId status")
      .lean(),
    Follow.find({ followerId: { $in: uniqueIds }, followingId: dbUser._id, status: "accepted" })
      .select("followerId")
      .lean(),
  ]);

  const iFollowStatus = new Map(iFollowRows.map((row) => [String(row.followingId), row.status]));
  const followsMeSet = new Set(followsMeRows.map((row) => String(row.followerId)));

  uniqueIds.forEach((id) => {
    const key = String(id);
    const status = iFollowStatus.get(key);
    const followStatus: FollowStatus = status === "accepted" ? "following" : status === "pending" ? "requested" : "none";
    statusByUserId.set(key, followStatus);
    relationByUserId.set(key, {
      iFollow: followStatus === "following",
      followsMe: followsMeSet.has(key),
      isMe: key === String(dbUser._id),
    });
  });

  return { relationByUserId, statusByUserId };
}

async function serializeUsersWithRelations(dbUser: FirebaseAuthedRequest["dbUser"], users: PublicUserRow[]) {
  const { relationByUserId, statusByUserId } = await relationMapsFor(
    dbUser,
    users.map((u) => u._id),
  );
  return users.map((u) => {
    const key = String(u._id);
    return serializeUserRow(u, relationByUserId.get(key), statusByUserId.get(key) ?? "none");
  });
}

async function getInterestWeights(dbUser: FirebaseAuthedRequest["dbUser"]): Promise<Map<string, number>> {
  const weights = new Map<string, number>();
  const add = (raw: unknown, weight: number) => {
    const value = normalizeInterest(raw);
    if (!value) return;
    weights.set(value, (weights.get(value) ?? 0) + weight);
  };

  (dbUser?.interests ?? []).forEach((interest) => add(interest, 1));
  if (!dbUser) return weights;

  const [likedRows, savedRows] = await Promise.all([
    Like.find({ userId: dbUser._id, targetType: "post" })
      .sort({ createdAt: -1 })
      .limit(40)
      .select("targetId")
      .lean(),
    mongoose.connection
      .collection("saved_posts")
      .find({ $or: [{ userId: dbUser._id }, { userId: String(dbUser._id) }] })
      .sort({ createdAt: -1 })
      .limit(40)
      .project<{ postId?: mongoose.Types.ObjectId }>({ postId: 1 })
      .toArray(),
  ]);

  const postIds = [
    ...likedRows.map((row) => row.targetId),
    ...savedRows.map((row) => row.postId).filter((id): id is mongoose.Types.ObjectId => id != null),
  ];
  if (postIds.length === 0) return weights;

  const posts = await Post.find({ _id: { $in: postIds } })
    .select("feedCategory tags")
    .lean();
  posts.forEach((post) => {
    add(post.feedCategory, 0.75);
    (post.tags ?? []).slice(0, 5).forEach((tag) => add(tag, 0.25));
  });
  return weights;
}

// ── GET /users/suggestions ───────────────────────────────────────────
followRouter.get(
  "/suggestions",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const dbUser = req.dbUser;
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 20);
      const peerId = typeof req.query.peerId === "string" && mongoose.Types.ObjectId.isValid(req.query.peerId)
        ? new mongoose.Types.ObjectId(req.query.peerId)
        : null;

      let excludeIds: mongoose.Types.ObjectId[] = [];
      let myFollowingIds: mongoose.Types.ObjectId[] = [];
      if (dbUser) {
        const follows = await Follow.find({ followerId: dbUser._id, status: "accepted" }).select("followingId");
        myFollowingIds = follows.map((f) => f.followingId);
        excludeIds = [
          dbUser._id,
          ...myFollowingIds,
          ...toObjectIds((dbUser.blockedUserIds ?? []) as unknown[]),
        ];
      }

      const query = excludeIds.length
        ? { _id: { $nin: excludeIds }, isActive: true, onboardingComplete: true }
        : { isActive: true, onboardingComplete: true };

      const users = await User.find(query)
        .select(USER_SELECT)
        .sort({ followersCount: -1 })
        .limit(Math.max(limit * 4, 40))
        .lean();

      const candidateIds = users.map((u) => u._id);
      const [mutualRows, interestWeights] = await Promise.all([
        dbUser && myFollowingIds.length && candidateIds.length
          ? Follow.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
              {
                $match: {
                  followerId: { $in: myFollowingIds },
                  followingId: { $in: candidateIds },
                  status: "accepted",
                },
              },
              { $group: { _id: "$followingId", count: { $sum: 1 } } },
            ])
          : Promise.resolve([]),
        getInterestWeights(dbUser),
      ]);
      const mutualCounts = new Map(mutualRows.map((row) => [String(row._id), row.count]));
      const peerBoostIds = new Set<string>();
      if (peerId && myFollowingIds.length) {
        const peerMutuals = await Follow.find({
          followerId: { $in: myFollowingIds },
          followingId: peerId,
          status: "accepted",
        })
          .select("followerId")
          .limit(50)
          .lean();
        peerMutuals.forEach((row) => peerBoostIds.add(String(row.followerId)));
      }

      return res.json({
        users: users
          .map((u) => {
            const interestOverlap = (u.interests ?? []).reduce(
              (sum, interest) => sum + (interestWeights.get(normalizeInterest(interest)) ?? 0),
              0,
            );
            const score =
              2 * (mutualCounts.get(String(u._id)) ?? 0) +
              0.5 * interestOverlap +
              0.1 * Math.log((u.followersCount ?? 0) + 1) +
              (peerBoostIds.has(String(u._id)) ? 1 : 0);
            return { user: serializeUserRow(u), score };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, limit)
          .map((row) => row.user),
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
      const blockedIds = dbUser ? toObjectIds((dbUser.blockedUserIds ?? []) as unknown[]) : [];
      const excludeSelf = dbUser ? { _id: { $nin: [dbUser._id, ...blockedIds] } } : {};
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

// ── GET /users/nearby?lat=&lng= ─────────────────────────────────────
followRouter.get(
  "/nearby",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const dbUser = req.dbUser;
      const lat = Number(req.query.lat);
      const lng = Number(req.query.lng);
      const maxDistance = Math.min(100_000, Math.max(100, Number(req.query.maxDistance) || 25_000));
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return res.status(400).json({message: "lat and lng are required"});
      }
      const blockedIds = dbUser ? toObjectIds((dbUser.blockedUserIds ?? []) as unknown[]) : [];
      const users = await User.aggregate([
        {
          $geoNear: {
            near: {type: "Point", coordinates: [lng, lat]},
            distanceField: "distanceMeters",
            spherical: true,
            maxDistance,
            query: {
              isActive: true,
              onboardingComplete: true,
              ...(dbUser ? {_id: {$nin: [dbUser._id, ...blockedIds]}} : {}),
            },
          },
        },
        {$limit: 30},
        {$project: {username: 1, displayName: 1, profilePicture: 1, followersCount: 1, distanceMeters: 1}},
      ]);
      return res.json({users});
    } catch (err) {
      console.error("[follow] nearby error:", err);
      return res.status(500).json({message: "Failed to find nearby users"});
    }
  },
);

// ── POST /users/location ────────────────────────────────────────────
followRouter.post(
  "/location",
  requireVerifiedUser,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const user = req.dbUser!;
      const {lat, lng} = req.body as {lat?: number; lng?: number};
      if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
        return res.status(400).json({message: "lat and lng are required"});
      }
      user.currentLocation = {
        type: "Point",
        coordinates: [Number(lng), Number(lat)],
        updatedAt: new Date(),
      };
      await user.save();
      return res.json({ok: true});
    } catch (err) {
      console.error("[follow] location error:", err);
      return res.status(500).json({message: "Failed to update location"});
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
      const isSelf = dbUser != null && String(dbUser._id) === String(req.params.userId);
      const target = await User.findById(req.params.userId)
        .select(`${isSelf ? SELF_USER_SELECT : USER_SELECT} ${PROFILE_SELECT}`)
        .lean();
      if (!target) return res.status(404).json({ message: "User not found" });
      if (dbUser && ((dbUser.blockedUserIds ?? []) as unknown[]).some((id) => String(id) === String(target._id))) {
        return res.status(403).json({message: "User is blocked"});
      }

      let followStatus: "none" | "following" | "requested" = "none";
      let followsMe = false;
      if (dbUser) {
        const [follow, inverseFollow] = await Promise.all([
          Follow.findOne({
            followerId: dbUser._id,
            followingId: target._id,
          }).lean(),
          Follow.findOne({
            followerId: target._id,
            followingId: dbUser._id,
            status: "accepted",
          }).lean(),
        ]);
        if (follow) {
          followStatus = follow.status === "accepted" ? "following" : "requested";
        }
        followsMe = Boolean(inverseFollow);
      }

      return res.json({
        user: {
          ...target,
          followersCount: target.followersCount ?? 0,
          followingCount: target.followingCount ?? 0,
          postsCount: target.postsCount ?? 0,
          followStatus,
          followsMe,
          relation: {
            iFollow: followStatus === "following",
            followsMe,
            isMe: isSelf,
          },
        },
      });
    } catch (err) {
      console.error("[follow] profile error:", err);
      return res.status(500).json({ message: "Failed to get profile" });
    }
  },
);

// ── GET /users/:userId/mutuals?limit= ────────────────────────────────
followRouter.get(
  "/:userId/mutuals",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const dbUser = req.dbUser;
      const targetId = String(req.params.userId);
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 3, 1), 12);
      if (!dbUser || !mongoose.Types.ObjectId.isValid(targetId)) {
        return res.json({ count: 0, sample: [] });
      }

      const targetObjectId = new mongoose.Types.ObjectId(targetId);
      const myFollowing = await Follow.find({ followerId: dbUser._id, status: "accepted" })
        .select("followingId")
        .lean();
      const myFollowingIds = myFollowing.map((row) => row.followingId);
      if (myFollowingIds.length === 0) {
        return res.json({ count: 0, sample: [] });
      }

      const mutualIds = await Follow.distinct("followerId", {
        followerId: { $in: myFollowingIds },
        followingId: targetObjectId,
        status: "accepted",
      });
      if (mutualIds.length === 0) {
        return res.json({ count: 0, sample: [] });
      }

      const sample = await User.find({ _id: { $in: mutualIds } })
        .select(USER_SELECT)
        .limit(limit)
        .lean();
      return res.json({
        count: mutualIds.length,
        sample: sample.map((u) => serializeUserRow(u)),
      });
    } catch (err) {
      console.error("[follow] mutuals error:", err);
      return res.status(500).json({ message: "Failed to get mutuals" });
    }
  },
);

// ── POST /users/:userId/block ───────────────────────────────────────
followRouter.post(
  "/:userId/block",
  requireVerifiedUser,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const user = req.dbUser!;
      const targetId = String(req.params.userId);
      if (!mongoose.Types.ObjectId.isValid(targetId)) {
        return res.status(400).json({message: "Invalid user id"});
      }
      if (String(user._id) === targetId) {
        return res.status(400).json({message: "Cannot block yourself"});
      }
      const target = await User.findById(targetId).select("_id").lean();
      if (!target) return res.status(404).json({message: "User not found"});
      const followsToDelete = await Follow.find({
        $or: [
          {followerId: user._id, followingId: target._id},
          {followerId: target._id, followingId: user._id},
        ],
      })
        .select("followerId followingId status")
        .lean();
      await Promise.all([
        User.updateOne({_id: user._id}, {$addToSet: {blockedUserIds: target._id}}),
        Follow.deleteMany({
          $or: [
            {followerId: user._id, followingId: target._id},
            {followerId: target._id, followingId: user._id},
          ],
        }),
      ]);
      await Promise.all(
        followsToDelete
          .filter((follow) => follow.status === "accepted")
          .flatMap((follow) => [
            User.findByIdAndUpdate(follow.followerId, { $inc: { followingCount: -1 } }),
            User.findByIdAndUpdate(follow.followingId, { $inc: { followersCount: -1 } }),
          ]),
      );
      return res.json({blocked: true});
    } catch (err) {
      console.error("[follow] block error:", err);
      return res.status(500).json({message: "Failed to block user"});
    }
  },
);

// ── DELETE /users/:userId/block ────────────────────────────────────
followRouter.delete(
  "/:userId/block",
  requireVerifiedUser,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const user = req.dbUser!;
      const targetId = String(req.params.userId);
      if (!mongoose.Types.ObjectId.isValid(targetId)) {
        return res.status(400).json({message: "Invalid user id"});
      }
      await User.updateOne({_id: user._id}, {$pull: {blockedUserIds: new mongoose.Types.ObjectId(targetId)}});
      return res.json({blocked: false});
    } catch (err) {
      console.error("[follow] unblock error:", err);
      return res.status(500).json({message: "Failed to unblock user"});
    }
  },
);

// ── POST /users/:userId/report ───────────────────────────────────────
followRouter.post(
  "/:userId/report",
  requireVerifiedUser,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const user = req.dbUser!;
      const targetId = String(req.params.userId);
      if (!mongoose.Types.ObjectId.isValid(targetId)) {
        return res.status(400).json({ message: "Invalid user id" });
      }
      if (String(user._id) === targetId) {
        return res.status(400).json({ message: "Cannot report yourself" });
      }
      const target = await User.findById(targetId).select("_id").lean();
      if (!target) return res.status(404).json({ message: "User not found" });

      const reason = typeof req.body?.reason === "string" && req.body.reason.trim()
        ? req.body.reason.trim().slice(0, 80)
        : "other";
      await mongoose.connection.collection("user_reports").updateOne(
        { targetUserId: target._id, reporterId: user._id },
        {
          $set: { reason, updatedAt: new Date() },
          $setOnInsert: { targetUserId: target._id, reporterId: user._id, createdAt: new Date() },
        },
        { upsert: true },
      );
      return res.json({ reported: true });
    } catch (err) {
      console.error("[follow] report user error:", err);
      return res.status(500).json({ message: "Failed to report user" });
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
      const users = follows.map((f) => f.followerId).filter(isPublicUserRow);
      const decoratedUsers = await serializeUsersWithRelations(req.dbUser, users);

      return res.json({
        users: decoratedUsers,
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
      const users = follows.map((f) => f.followingId).filter(isPublicUserRow);
      const decoratedUsers = await serializeUsersWithRelations(req.dbUser, users);

      return res.json({
        users: decoratedUsers,
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
        const targetAlreadyFollowsMe = await Follow.exists({
          followerId: target._id,
          followingId: follower._id,
          status: "accepted",
        });
        const notificationType = targetAlreadyFollowsMe ? "follow_back" : "follow";
        const notificationMessage = targetAlreadyFollowsMe
          ? `${follower.displayName} followed you back`
          : `${follower.displayName} started following you`;
        const [, updatedTarget] = await Promise.all([
          User.findByIdAndUpdate(follower._id, { $inc: { followingCount: 1 } }),
          User.findByIdAndUpdate(targetId, { $inc: { followersCount: 1 } }, { new: true }),
        ]);
        // Persist follow notification
        void createNotification({
          recipientId: targetId,
          actorId: follower._id,
          type: notificationType,
          message: notificationMessage,
        });
        emitNotification(
          String(targetId),
          notificationType,
          String(follower._id),
          String(follower._id),
          notificationMessage,
        );
        // Milestone check
        if (updatedTarget) {
          void checkFollowerMilestone(targetId, updatedTarget.followersCount ?? 0);
        }
      } else {
        // pending request notification
        void createNotification({
          recipientId: targetId,
          actorId: follower._id,
          type: "follow_request",
          message: `${follower.displayName} requested to follow you`,
        });
        emitNotification(
          String(targetId),
          "follow_request",
          String(follower._id),
          String(follower._id),
          `${follower.displayName} requested to follow you`,
        );
      }

      return res.json({ status });
    } catch (err) {
      console.error("[follow] follow error:", err);
      return res.status(500).json({ message: "Failed to follow" });
    }
  },
);

// ── DELETE /users/:userId/follower ───────────────────────────────────
followRouter.delete(
  "/:userId/follower",
  requireVerifiedUser,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const user = req.dbUser!;
      const targetId = String(req.params.userId);
      if (!mongoose.Types.ObjectId.isValid(targetId)) {
        return res.status(400).json({ message: "Invalid user id" });
      }

      const follow = await Follow.findOne({ followerId: targetId, followingId: user._id });
      if (!follow) return res.status(404).json({ message: "Follower not found" });

      const wasAccepted = follow.status === "accepted";
      await follow.deleteOne();

      if (wasAccepted) {
        await Promise.all([
          User.findByIdAndUpdate(targetId, { $inc: { followingCount: -1 } }),
          User.findByIdAndUpdate(user._id, { $inc: { followersCount: -1 } }),
        ]);
      }

      return res.json({ removed: true });
    } catch (err) {
      console.error("[follow] remove follower error:", err);
      return res.status(500).json({ message: "Failed to remove follower" });
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
      void createNotification({
        recipientId: follow.followerId,
        actorId: user._id,
        type: "follow_accept",
        message: `${user.displayName} accepted your follow request`,
      });
      emitNotification(
        String(follow.followerId),
        "follow_accept",
        String(user._id),
        String(user._id),
        `${user.displayName} accepted your follow request`,
      );
      if (updatedMe) void checkFollowerMilestone(String(user._id), updatedMe.followersCount ?? 0);

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
