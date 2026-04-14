import { Router, type Response } from "express";
import {
  requireFirebaseToken,
  type FirebaseAuthedRequest,
} from "../middleware/firebaseAuth.js";
import { Notification } from "../models/Notification.js";
import { emitNotificationUnreadForUser } from "../services/socketService.js";

export const notificationsRouter = Router();

const ACTOR_SELECT = "username displayName profilePicture";
const PAGE_SIZE = 30;

// ── GET /notifications ───────────────────────────────────────────────
notificationsRouter.get(
  "/",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    if (!req.dbUser) return res.json({ notifications: [], hasMore: false });
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const unreadOnly = req.query.unreadOnly === "true";
      const skip = (page - 1) * PAGE_SIZE;

      const query = {
        recipientId: req.dbUser._id,
        ...(unreadOnly ? { read: false } : {}),
      };

      const [notifications, unreadCount] = await Promise.all([
        Notification.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(PAGE_SIZE)
          .populate("actorId", ACTOR_SELECT)
          .lean(),
        Notification.countDocuments({ recipientId: req.dbUser._id, read: false }),
      ]);

      return res.json({
        notifications,
        unreadCount,
        page,
        hasMore: notifications.length === PAGE_SIZE,
      });
    } catch (err) {
      console.error("[notif] list error:", err);
      return res.status(500).json({ message: "Failed to fetch notifications" });
    }
  },
);

// ── GET /notifications/unread-count ─────────────────────────────────
notificationsRouter.get(
  "/unread-count",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    if (!req.dbUser) return res.json({ count: 0 });
    try {
      const count = await Notification.countDocuments({
        recipientId: req.dbUser._id,
        read: false,
      });
      return res.json({ count });
    } catch {
      return res.json({ count: 0 });
    }
  },
);

// ── POST /notifications/read-all ─────────────────────────────────────
notificationsRouter.post(
  "/read-all",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    if (!req.dbUser) return res.json({ ok: true });
    try {
      await Notification.updateMany(
        { recipientId: req.dbUser._id, read: false },
        { $set: { read: true } },
      );
      void emitNotificationUnreadForUser(String(req.dbUser._id));
      return res.json({ ok: true });
    } catch {
      return res.json({ ok: true });
    }
  },
);

// ── PATCH /notifications/:id/read ────────────────────────────────────
notificationsRouter.patch(
  "/:id/read",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    if (!req.dbUser) return res.json({ ok: true });
    try {
      await Notification.findOneAndUpdate(
        { _id: req.params.id, recipientId: req.dbUser._id },
        { $set: { read: true } },
      );
      void emitNotificationUnreadForUser(String(req.dbUser._id));
      return res.json({ ok: true });
    } catch {
      return res.json({ ok: true });
    }
  },
);
