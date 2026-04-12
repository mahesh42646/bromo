import {type Server as HttpServer} from "node:http";
import {Server, type Socket} from "socket.io";
import admin from "firebase-admin";

let io: Server | null = null;

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
      socket.data.uid = decoded.uid;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const uid = socket.data.uid as string;
    socket.join(`user:${uid}`);

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
        userId: uid,
        text,
        createdAt: new Date().toISOString(),
      });
    });

    socket.on("live:send_like", ({streamId}: {streamId: string}) => {
      io?.to(`live:${streamId}`).emit("live:like", {streamId, userId: uid});
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

/** Send notification to a specific user */
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
