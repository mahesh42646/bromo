import { Router, type Response } from "express";
import mongoose from "mongoose";
import {
  requireVerifiedUser,
  type FirebaseAuthedRequest,
} from "../middleware/firebaseAuth.js";
import { Conversation } from "../models/Conversation.js";
import { Message } from "../models/Message.js";
import { User } from "../models/User.js";

export const chatRouter = Router();

const USER_SELECT = "username displayName profilePicture";
const MSG_PAGE = 30;

// ── GET /chat/conversations ──────────────────────────────────────────
chatRouter.get(
  "/conversations",
  requireVerifiedUser,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const user = req.dbUser!;

      const conversations = await Conversation.find({
        participants: user._id,
        isActive: true,
      })
        .sort({ lastMessageAt: -1 })
        .populate("participants", USER_SELECT)
        .lean();

      type PopParticipant = { _id: mongoose.Types.ObjectId; username: string; displayName: string; profilePicture: string };
      const result = conversations.map((c) => {
        const parts = c.participants as unknown as PopParticipant[];
        const other = parts.filter((p) => String(p._id) !== String(user._id));
        const unreadMap = c.unreadCounts as unknown as Record<string, number> | undefined;
        const unread = unreadMap?.[String(user._id)] ?? 0;
        return { ...c, otherParticipants: other, unreadCount: unread };
      });

      return res.json({ conversations: result });
    } catch (err) {
      console.error("[chat] conversations error:", err);
      return res.status(500).json({ message: "Failed to fetch conversations" });
    }
  },
);

// ── POST /chat/conversations ─────────────────────────────────────────
chatRouter.post(
  "/conversations",
  requireVerifiedUser,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const user = req.dbUser!;
      const { participantId } = req.body as { participantId: string };

      if (!participantId) return res.status(400).json({ message: "participantId required" });

      const target = await User.findById(participantId);
      if (!target) return res.status(404).json({ message: "User not found" });

      const existing = await Conversation.findOne({
        participants: { $all: [user._id, participantId], $size: 2 },
        isGroup: false,
        isActive: true,
      }).populate("participants", USER_SELECT);

      if (existing) {
        return res.json({ conversation: existing, created: false });
      }

      const conversation = await Conversation.create({
        participants: [user._id, participantId],
        isGroup: false,
      });

      const populated = await Conversation.findById(conversation._id)
        .populate("participants", USER_SELECT)
        .lean();

      return res.status(201).json({ conversation: populated, created: true });
    } catch (err) {
      console.error("[chat] create conversation error:", err);
      return res.status(500).json({ message: "Failed to create conversation" });
    }
  },
);

// ── GET /chat/conversations/:id/messages ────────────────────────────
chatRouter.get(
  "/conversations/:id/messages",
  requireVerifiedUser,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const user = req.dbUser!;
      const { id } = req.params;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const skip = (page - 1) * MSG_PAGE;

      const conversation = await Conversation.findOne({
        _id: id,
        participants: user._id,
      });
      if (!conversation) return res.status(404).json({ message: "Conversation not found" });

      const messages = await Message.find({ conversationId: id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(MSG_PAGE)
        .populate("senderId", USER_SELECT)
        .populate("replyToId")
        .lean();

      // Mark as read
      const counts = conversation.unreadCounts as Map<string, number>;
      counts.set(String(user._id), 0);
      conversation.unreadCounts = counts;
      await conversation.save();

      return res.json({
        messages: messages.reverse(),
        page,
        hasMore: messages.length === MSG_PAGE,
      });
    } catch (err) {
      console.error("[chat] messages error:", err);
      return res.status(500).json({ message: "Failed to fetch messages" });
    }
  },
);

// ── POST /chat/conversations/:id/messages ───────────────────────────
chatRouter.post(
  "/conversations/:id/messages",
  requireVerifiedUser,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const user = req.dbUser!;
      const { id } = req.params;
      const { type, text, mediaUrl, meta, replyToId } = req.body as {
        type: string;
        text?: string;
        mediaUrl?: string;
        meta?: Record<string, unknown>;
        replyToId?: string;
      };

      const conversation = await Conversation.findOne({
        _id: id,
        participants: user._id,
      });
      if (!conversation) return res.status(404).json({ message: "Conversation not found" });

      if (!type) return res.status(400).json({ message: "type required" });
      if (type === "text" && !text?.trim()) return res.status(400).json({ message: "text required" });

      const message = await Message.create({
        conversationId: id,
        senderId: user._id,
        type,
        text: text?.trim() ?? "",
        mediaUrl: mediaUrl ?? "",
        meta: meta ?? {},
        replyToId: replyToId || undefined,
      });

      // Update conversation
      const preview = type === "text" ? (text ?? "") : `[${type}]`;
      const counts = conversation.unreadCounts as Map<string, number>;
      for (const pid of conversation.participants) {
        if (String(pid) !== String(user._id)) {
          counts.set(String(pid), (counts.get(String(pid)) ?? 0) + 1);
        }
      }
      conversation.lastMessageText = preview;
      conversation.lastMessageAt = new Date();
      conversation.lastMessageSenderId = user._id;
      conversation.unreadCounts = counts;
      await conversation.save();

      const populated = await Message.findById(message._id)
        .populate("senderId", USER_SELECT)
        .lean();

      return res.status(201).json({ message: populated });
    } catch (err) {
      console.error("[chat] send message error:", err);
      return res.status(500).json({ message: "Failed to send message" });
    }
  },
);

// ── PUT /chat/messages/:id/unsend ────────────────────────────────────
chatRouter.put(
  "/messages/:id/unsend",
  requireVerifiedUser,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const user = req.dbUser!;
      const message = await Message.findById(req.params.id);
      if (!message) return res.status(404).json({ message: "Message not found" });
      if (String(message.senderId) !== String(user._id)) {
        return res.status(403).json({ message: "Not authorized" });
      }
      message.isUnsent = true;
      message.text = "";
      message.mediaUrl = "";
      await message.save();
      return res.json({ unsent: true });
    } catch (err) {
      console.error("[chat] unsend error:", err);
      return res.status(500).json({ message: "Failed to unsend" });
    }
  },
);

// ── PUT /chat/messages/:id ───────────────────────────────────────────
chatRouter.put(
  "/messages/:id",
  requireVerifiedUser,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const user = req.dbUser!;
      const { text } = req.body as { text: string };
      if (!text?.trim()) return res.status(400).json({ message: "text required" });

      const message = await Message.findById(req.params.id);
      if (!message) return res.status(404).json({ message: "Message not found" });
      if (String(message.senderId) !== String(user._id)) {
        return res.status(403).json({ message: "Not authorized" });
      }
      if (message.type !== "text") return res.status(400).json({ message: "Only text messages can be edited" });

      message.text = text.trim();
      message.editedAt = new Date();
      await message.save();

      return res.json({ message });
    } catch (err) {
      console.error("[chat] edit message error:", err);
      return res.status(500).json({ message: "Failed to edit message" });
    }
  },
);

// ── POST /chat/messages/:id/react ────────────────────────────────────
chatRouter.post(
  "/messages/:id/react",
  requireVerifiedUser,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const user = req.dbUser!;
      const { emoji } = req.body as { emoji: string };
      if (!emoji) return res.status(400).json({ message: "emoji required" });

      const message = await Message.findById(req.params.id);
      if (!message) return res.status(404).json({ message: "Message not found" });

      const existing = message.reactions.findIndex((r) => String(r.userId) === String(user._id) && r.emoji === emoji);
      if (existing >= 0) {
        message.reactions.splice(existing, 1);
      } else {
        message.reactions.push({ userId: user._id, emoji });
      }
      await message.save();

      return res.json({ reactions: message.reactions });
    } catch (err) {
      console.error("[chat] react error:", err);
      return res.status(500).json({ message: "Failed to react" });
    }
  },
);

// ── POST /chat/conversations/:id/read ───────────────────────────────
chatRouter.post(
  "/conversations/:id/read",
  requireVerifiedUser,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const user = req.dbUser!;
      const conversation = await Conversation.findOne({
        _id: req.params.id,
        participants: user._id,
      });
      if (!conversation) return res.status(404).json({ message: "Conversation not found" });

      const counts = conversation.unreadCounts as Map<string, number>;
      counts.set(String(user._id), 0);
      conversation.unreadCounts = counts;
      await conversation.save();

      return res.json({ ok: true });
    } catch (err) {
      console.error("[chat] read error:", err);
      return res.status(500).json({ message: "Failed to mark read" });
    }
  },
);
