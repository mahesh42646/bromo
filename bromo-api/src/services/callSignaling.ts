import mongoose from "mongoose";
import type { Server as SocketIOServer, Socket } from "socket.io";
import { sendCallInviteDataPush, sendVoipCallInvitePush } from "./pushService.js";

/** In-memory WebRTC call sessions (replace with Redis for multi-instance). */
export type PendingCall = {
  fromUserId: string;
  toUserId: string;
  callType: "audio" | "video";
  state: "ringing" | "active";
  createdAt: number;
};

const CALL_TTL_MS = 120_000;
export const pendingCalls = new Map<string, PendingCall>();

export function pruneStaleCalls(): void {
  const now = Date.now();
  for (const [id, p] of pendingCalls) {
    if (now - p.createdAt > CALL_TTL_MS) pendingCalls.delete(id);
  }
}

function isParty(userId: string, p: PendingCall): boolean {
  return String(p.fromUserId) === String(userId) || String(p.toUserId) === String(userId);
}

export function otherParty(p: PendingCall, userId: string): string | null {
  if (String(p.fromUserId) === String(userId)) return String(p.toUserId);
  if (String(p.toUserId) === String(userId)) return String(p.fromUserId);
  return null;
}

/** Socket.io handlers — attach inside `io.on("connection")`. */
export function attachCallSignalingHandlers(io: SocketIOServer, socket: Socket, mongoId: string | null): void {
  if (!mongoId) return;

  socket.on(
    "call:invite",
    (payload: { callId?: string; toUserId?: string; callType?: string; callerName?: string }) => {
      const callId = String(payload?.callId ?? "").trim();
      const toUserId = String(payload?.toUserId ?? "").trim();
      const callType = payload?.callType === "video" ? "video" : "audio";
      const callerName = String(payload?.callerName ?? "").trim().slice(0, 80);
      if (!callId || !toUserId || !mongoose.Types.ObjectId.isValid(toUserId)) return;
      if (String(toUserId) === String(mongoId)) return;
      if (pendingCalls.has(callId)) return;

      pendingCalls.set(callId, {
        fromUserId: String(mongoId),
        toUserId,
        callType,
        state: "ringing",
        createdAt: Date.now(),
      });

      io.to(`user:${toUserId}`).emit("call:incoming", {
        callId,
        fromUserId: String(mongoId),
        callType,
        callerName: callerName || undefined,
      });

      const invitePayload = {
        callId,
        fromUserId: String(mongoId),
        callType,
        callerName,
      };
      void Promise.all([
        sendCallInviteDataPush(toUserId, invitePayload),
        sendVoipCallInvitePush(toUserId, invitePayload),
      ]);
    },
  );

  socket.on("call:accept", (payload: { callId?: string }) => {
    const callId = String(payload?.callId ?? "").trim();
    const p = pendingCalls.get(callId);
    if (!p || p.state !== "ringing" || String(p.toUserId) !== String(mongoId)) return;
    p.state = "active";
    p.createdAt = Date.now();
    io.to(`user:${p.fromUserId}`).emit("call:accepted", { callId, peerUserId: String(mongoId) });
  });

  socket.on("call:reject", (payload: { callId?: string }) => {
    const callId = String(payload?.callId ?? "").trim();
    const p = pendingCalls.get(callId);
    if (!p || String(p.toUserId) !== String(mongoId)) return;
    pendingCalls.delete(callId);
    io.to(`user:${p.fromUserId}`).emit("call:rejected", { callId });
  });

  socket.on("call:end", (payload: { callId?: string }) => {
    const callId = String(payload?.callId ?? "").trim();
    const p = pendingCalls.get(callId);
    if (!p || !isParty(String(mongoId), p)) return;
    const target = otherParty(p, String(mongoId));
    pendingCalls.delete(callId);
    if (target) {
      io.to(`user:${target}`).emit("call:ended", { callId, byUserId: String(mongoId) });
    }
  });

  socket.on(
    "call:sdp",
    (payload: { toUserId?: string; callId?: string; sdp?: string; sdpType?: string }) => {
      const toUserId = String(payload?.toUserId ?? "").trim();
      const callId = String(payload?.callId ?? "").trim();
      const sdp = String(payload?.sdp ?? "");
      const sdpType = payload?.sdpType === "answer" ? "answer" : "offer";
      if (!toUserId || !callId || !sdp) return;
      const p = pendingCalls.get(callId);
      if (!p || p.state !== "active" || !isParty(String(mongoId), p)) return;
      const expectedPeer = otherParty(p, String(mongoId));
      if (!expectedPeer || String(toUserId) !== String(expectedPeer)) return;
      io.to(`user:${toUserId}`).emit("call:sdp", {
        callId,
        fromUserId: String(mongoId),
        sdp,
        sdpType,
      });
    },
  );

  socket.on(
    "call:ice",
    (payload: { toUserId?: string; callId?: string; candidate?: Record<string, unknown> | null }) => {
      const toUserId = String(payload?.toUserId ?? "").trim();
      const callId = String(payload?.callId ?? "").trim();
      const candidate = payload?.candidate;
      if (!toUserId || !callId || candidate == null) return;
      const p = pendingCalls.get(callId);
      if (!p || p.state !== "active" || !isParty(String(mongoId), p)) return;
      const expectedPeer = otherParty(p, String(mongoId));
      if (!expectedPeer || String(toUserId) !== String(expectedPeer)) return;
      io.to(`user:${toUserId}`).emit("call:ice", {
        callId,
        fromUserId: String(mongoId),
        candidate,
      });
    },
  );
}
