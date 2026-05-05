import {type Server as HttpServer} from "node:http";
import mongoose from "mongoose";
import {Server, type Socket} from "socket.io";
import admin from "firebase-admin";
import { User } from "../models/User.js";
import { Notification } from "../models/Notification.js";
import { Conversation } from "../models/Conversation.js";
import { attachCallSignalingHandlers, pruneStaleCalls } from "./callSignaling.js";

let io: Server | null = null;
let callPruneTimer: ReturnType<typeof setInterval> | null = null;

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

function conversationRoom(conversationId: string): string {
  return `dm:${conversationId}`;
}

async function canAccessConversation(conversationId: string, mongoUserId: string): Promise<boolean> {
  if (!mongoose.Types.ObjectId.isValid(conversationId) || !mongoose.Types.ObjectId.isValid(mongoUserId)) return false;
  const found = await Conversation.exists({
    _id: conversationId,
    participants: new mongoose.Types.ObjectId(mongoUserId),
    isActive: true,
  });
  return Boolean(found);
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

  if (!callPruneTimer) {
    callPruneTimer = setInterval(() => pruneStaleCalls(), 30_000);
    callPruneTimer.unref?.();
  }

  io.on("connection", (socket: Socket) => {
    const mongoId = socket.data.mongoUserId as string | null;
    const firebaseUid = socket.data.firebaseUid as string;
    if (mongoId) {
      socket.join(`user:${mongoId}`);
      void emitNotificationUnreadForUser(mongoId);
      void emitChatUnreadForUser(mongoId);
      void Conversation.find({participants: new mongoose.Types.ObjectId(mongoId), isActive: true})
        .select("_id")
        .lean()
        .then(rows => rows.forEach(row => socket.join(conversationRoom(String(row._id)))))
        .catch(() => null);
      socket.broadcast.emit("presence:online", {userId: mongoId});
    }

    if (io) attachCallSignalingHandlers(io, socket, mongoId);

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

    socket.on("chat:join", async ({conversationId}: {conversationId?: string}) => {
      if (!mongoId || !conversationId) return;
      if (await canAccessConversation(conversationId, mongoId)) {
        socket.join(conversationRoom(conversationId));
      }
    });

    socket.on("typing:start", async ({conversationId}: {conversationId?: string}) => {
      if (!mongoId || !conversationId) return;
      if (await canAccessConversation(conversationId, mongoId)) {
        io?.to(conversationRoom(conversationId)).emit("typing:start", {conversationId, userId: mongoId});
      }
    });

    socket.on("typing:stop", async ({conversationId}: {conversationId?: string}) => {
      if (!mongoId || !conversationId) return;
      if (await canAccessConversation(conversationId, mongoId)) {
        io?.to(conversationRoom(conversationId)).emit("typing:stop", {conversationId, userId: mongoId});
      }
    });

    socket.on("disconnect", () => {
      if (mongoId) socket.broadcast.emit("presence:offline", {userId: mongoId});
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

export function emitPostShare(postId: string, sharesCount: number): void {
  io?.emit("post:share", {postId, sharesCount});
}

export function emitChatMessage(conversationId: string, participantIds: string[], message: object): void {
  io?.to(conversationRoom(conversationId)).emit("message:new", {conversationId, message});
  for (const participantId of participantIds) {
    io?.to(`user:${participantId}`).emit("chat:message", {conversationId, message});
    io?.to(`user:${participantId}`).emit("message:new", {conversationId, message});
  }
}

export function emitChatMessageUpdated(conversationId: string, participantIds: string[], message: object): void {
  for (const participantId of participantIds) {
    io?.to(`user:${participantId}`).emit("chat:message_updated", {conversationId, message});
  }
}

export function emitChatMessageEdited(conversationId: string, participantIds: string[], message: object): void {
  emitChatMessageUpdated(conversationId, participantIds, message);
  io?.to(conversationRoom(conversationId)).emit("message:edited", {conversationId, message});
  for (const participantId of participantIds) {
    io?.to(`user:${participantId}`).emit("message:edited", {conversationId, message});
  }
}

export function emitChatMessageUnsent(conversationId: string, participantIds: string[], message: object): void {
  emitChatMessageUpdated(conversationId, participantIds, message);
  io?.to(conversationRoom(conversationId)).emit("message:unsent", {conversationId, message});
  for (const participantId of participantIds) {
    io?.to(`user:${participantId}`).emit("message:unsent", {conversationId, message});
  }
}

export function emitChatReaction(conversationId: string, participantIds: string[], message: object): void {
  io?.to(conversationRoom(conversationId)).emit("message:reaction", {conversationId, message});
  for (const participantId of participantIds) {
    io?.to(`user:${participantId}`).emit("message:reaction", {conversationId, message});
  }
}

export function emitChatRead(conversationId: string, participantIds: string[], readerId: string): void {
  io?.to(conversationRoom(conversationId)).emit("message:read", {conversationId, readerId});
  for (const participantId of participantIds) {
    io?.to(`user:${participantId}`).emit("chat:read", {conversationId, readerId});
    io?.to(`user:${participantId}`).emit("message:read", {conversationId, readerId});
  }
}

export type PostDeleteMeta = {authorId?: string; type?: string};

export function emitPostDelete(postId: string, meta?: PostDeleteMeta): void {
  io?.emit("post:delete", {postId, ...meta});
}

export function emitStoryNew(authorId: string): void {
  io?.emit("story:new", {authorId});
}

export function emitStoryDelete(authorId: string, storyPostId: string): void {
  io?.emit("story:delete", {authorId, storyPostId});
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
