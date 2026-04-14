import {type Server as HttpServer} from "node:http";
import mongoose from "mongoose";
import {Server, type Socket} from "socket.io";
import admin from "firebase-admin";
import { User } from "../models/User.js";
import { Notification } from "../models/Notification.js";
import { Conversation } from "../models/Conversation.js";

let io: Server | null = null;

function sumConversationUnreadForUser(
  conversations: Array<{ unreadCounts?: unknown }>,
  sid: string,
): number {
  let total = 0;
  for (const c of conversations) {
    const raw = c.unreadCounts as Record<string, number> | Map<string, number> | undefined;
    if (!raw) continue;
    const n = raw instanceof Map ? raw.get(sid) : raw[sid];
    total += Math.max(0, Number(n) || 0);
  }
  return total;
}

/** Recompute notification badge and push to the user's socket room (Mongo user id). */
export async function emitNotificationUnreadForUser(recipientMongoId: string): Promise<void> {
  if (!io || !mongoose.Types.ObjectId.isValid(recipientMongoId)) return;
  try {
    const count = await Notification.countDocuments({
      recipientId: recipientMongoId,
      read: false,
    });
    io.to(`user:${recipientMongoId}`).emit("notification:unread", { count });
  } catch {
    /* ignore */
  }
}

/** Recompute total DMs unread across conversations for one user. */
export async function emitChatUnreadForUser(mongoUserId: string): Promise<void> {
  if (!io || !mongoose.Types.ObjectId.isValid(mongoUserId)) return;
  try {
    const sid = String(mongoUserId);
    const convs = await Conversation.find({
      participants: new mongoose.Types.ObjectId(mongoUserId),
      isActive: true,
    })
      .select("unreadCounts")
      .lean();
    const total = sumConversationUnreadForUser(convs, sid);
    io.to(`user:${sid}`).emit("chat:unread", { total });
  } catch {
    /* ignore */
  }
}

export function initSocketServer(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {origin: "*", credentials: true},
    transports: ["websocket", "polling"],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("No auth token"));
    try {
      const decoded = await admin.auth().verifyIdToken(token);
      socket.data.firebaseUid = decoded.uid;
      const dbUser = await User.findOne({ firebaseUid: decoded.uid }).select("_id").lean();
      socket.data.mongoUserId = dbUser ? String(dbUser._id) : null;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const mongoId = socket.data.mongoUserId as string | null;
    const firebaseUid = socket.data.firebaseUid as string;
    if (mongoId) {
      socket.join(`user:${mongoId}`);
      void emitNotificationUnreadForUser(mongoId);
      void emitChatUnreadForUser(mongoId);
    }

    // Live room join/leave
    socket.on("live:join", ({streamId}: {streamId: string}) => {
      socket.join(`live:${streamId}`);
      io?.to(`live:${streamId}`).emit("live:viewer_count", {
        streamId,
        viewerCount: io?.sockets.adapter.rooms.get(`live:${streamId}`)?.size ?? 0,
      });
    });

    socket.on("live:leave", ({streamId}: {streamId: string}) => {
      socket.leave(`live:${streamId}`);
      io?.to(`live:${streamId}`).emit("live:viewer_count", {
        streamId,
        viewerCount: io?.sockets.adapter.rooms.get(`live:${streamId}`)?.size ?? 0,
      });
    });

    socket.on("live:send_comment", ({streamId, text}: {streamId: string; text: string}) => {
      io?.to(`live:${streamId}`).emit("live:comment", {
        streamId,
        userId: firebaseUid,
        text,
        createdAt: new Date().toISOString(),
      });
    });

    socket.on("live:send_like", ({streamId}: {streamId: string}) => {
      io?.to(`live:${streamId}`).emit("live:like", {streamId, userId: firebaseUid});
    });

    socket.on("disconnect", () => {
      // Clean up any live rooms
    });
  });

  return io;
}

/** Broadcast post events to all connected clients */
export function emitPostNew(post: object): void {
  io?.emit("post:new", post);
}

export function emitPostLike(postId: string, likesCount: number, liked: boolean, userId: string): void {
  io?.emit("post:like", {postId, likesCount, liked, userId});
}

export function emitPostComment(postId: string, commentsCount: number, comment: object): void {
  io?.emit("post:comment", {postId, commentsCount, comment});
}

export function emitPostDelete(postId: string): void {
  io?.emit("post:delete", {postId});
}

export function emitStoryNew(authorId: string): void {
  io?.emit("story:new", {authorId});
}

export function emitLiveStart(streamId: string, userId: string, title: string): void {
  io?.emit("live:start", {streamId, userId, title, viewerCount: 0});
}

export function emitLiveEnd(streamId: string): void {
  io?.emit("live:end", {streamId});
}

/** Send notification to a specific user (userId = MongoDB User id, matches socket room). */
export function emitNotification(
  userId: string,
  type: string,
  actorId: string,
  targetId: string,
  message: string,
): void {
  io?.to(`user:${userId}`).emit("notification", {type, actorId, targetId, message});
}

export function getIo(): Server | null {
  return io;
}
