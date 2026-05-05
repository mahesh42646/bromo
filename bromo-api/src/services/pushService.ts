import admin from "firebase-admin";
import { User } from "../models/User.js";

/** Wake callee app + deliver metadata for incoming WebRTC call (FCM data-only). */
export async function sendCallInviteDataPush(
  toUserId: string,
  data: { callId: string; fromUserId: string; callType: string; callerName?: string },
): Promise<void> {
  try {
    const user = await User.findById(toUserId).select("fcmTokens").lean();
    const tokens = [...new Set((user?.fcmTokens ?? []).filter(Boolean))];
    if (!tokens.length) return;

    const payload: Record<string, string> = {
      type: "incoming_call",
      callId: data.callId,
      fromUserId: data.fromUserId,
      callType: data.callType,
      callerName: data.callerName ?? "",
      deepLink: `bromo://incoming-call`,
    };

    const result = await admin.messaging().sendEachForMulticast({
      tokens,
      data: payload,
      android: { priority: "high" },
      apns: {
        headers: {
          "apns-push-type": "background",
          "apns-priority": "10",
        },
        payload: {
          aps: {
            contentAvailable: true,
          },
        },
      },
    });

    const invalid = result.responses
      .map((r, idx) => (!r.success ? tokens[idx] : ""))
      .filter((token): token is string => Boolean(token));
    if (invalid.length) {
      await User.updateOne({ _id: toUserId }, { $pull: { fcmTokens: { $in: invalid } } }).catch(() => null);
    }
  } catch (err) {
    console.warn("[push] call invite skipped:", err instanceof Error ? err.message : err);
  }
}

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; data?: Record<string, string> },
): Promise<void> {
  try {
    const user = await User.findById(userId).select("fcmTokens").lean();
    const tokens = [...new Set((user?.fcmTokens ?? []).filter(Boolean))];
    if (!tokens.length) return;

    const result = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data,
      android: {
        priority: "high",
      },
      apns: {
        headers: {
          "apns-priority": "10",
        },
        payload: {
          aps: {
            sound: "default",
          },
        },
      },
    });

    const invalid = result.responses
      .map((r, idx) => (!r.success ? tokens[idx] : ""))
      .filter((token): token is string => Boolean(token));
    if (invalid.length) {
      await User.updateOne({ _id: userId }, { $pull: { fcmTokens: { $in: invalid } } }).catch(() => null);
    }
  } catch (err) {
    console.warn("[push] send skipped:", err instanceof Error ? err.message : err);
  }
}

export async function sendIncomingCallPush(
  userId: string,
  payload: {callId: string; fromUserId: string; callType: "audio" | "video"; callerName?: string},
): Promise<void> {
  await sendPushToUser(userId, {
    title: payload.callerName || "Incoming BROMO call",
    body: payload.callType === "video" ? "Video call" : "Voice call",
    data: {
      kind: "call",
      deepLink: `bromo://chat/${payload.fromUserId}`,
      callId: payload.callId,
      fromUserId: payload.fromUserId,
      callType: payload.callType,
      callerName: payload.callerName || "",
    },
  });
}
