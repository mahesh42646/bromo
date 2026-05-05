import admin from "firebase-admin";
import { connect } from "node:http2";
import { createSign } from "node:crypto";
import { readFile } from "node:fs/promises";
import { User } from "../models/User.js";

type CallInvitePayload = {
  callId: string;
  fromUserId: string;
  callType: string;
  callerName?: string;
};

let cachedApnsJwt: { token: string; expiresAt: number } | null = null;

function base64Url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function apnsAuthKey(): Promise<string | null> {
  const inline = process.env.APNS_AUTH_KEY?.replace(/\\n/g, "\n").trim();
  if (inline) return inline;
  const path = process.env.APNS_AUTH_KEY_PATH?.trim();
  if (!path) return null;
  return readFile(path, "utf8");
}

async function apnsJwt(): Promise<string | null> {
  const teamId = process.env.APNS_TEAM_ID?.trim();
  const keyId = process.env.APNS_KEY_ID?.trim();
  const privateKey = await apnsAuthKey();
  if (!teamId || !keyId || !privateKey) return null;
  const now = Math.floor(Date.now() / 1000);
  if (cachedApnsJwt && cachedApnsJwt.expiresAt > now + 60) return cachedApnsJwt.token;
  const header = base64Url(JSON.stringify({ alg: "ES256", kid: keyId }));
  const claims = base64Url(JSON.stringify({ iss: teamId, iat: now }));
  const sign = createSign("SHA256");
  sign.update(`${header}.${claims}`);
  sign.end();
  const signature = base64Url(sign.sign({ key: privateKey, dsaEncoding: "ieee-p1363" }));
  const token = `${header}.${claims}.${signature}`;
  cachedApnsJwt = { token, expiresAt: now + 50 * 60 };
  return token;
}

async function sendApnsVoip(deviceToken: string, payload: CallInvitePayload): Promise<number> {
  const token = await apnsJwt();
  const topic = (process.env.APNS_VOIP_TOPIC || process.env.APNS_BUNDLE_ID || process.env.IOS_BUNDLE_ID || "").trim();
  if (!token || !topic) return 0;
  const endpoint = process.env.APNS_ENV === "production" ? "https://api.push.apple.com" : "https://api.sandbox.push.apple.com";
  const client = connect(endpoint);
  return new Promise<number>((resolve, reject) => {
    let status = 0;
    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      authorization: `bearer ${token}`,
      "apns-topic": topic,
      "apns-push-type": "voip",
      "apns-priority": "10",
      "content-type": "application/json",
    });
    req.setEncoding("utf8");
    req.on("response", headers => {
      status = Number(headers[":status"] ?? 0);
    });
    req.on("data", () => undefined);
    req.on("end", () => {
      client.close();
      resolve(status);
    });
    req.on("error", err => {
      client.close();
      reject(err);
    });
    req.end(
      JSON.stringify({
        aps: {
          alert: {
            title: payload.callerName || "Incoming BROMO call",
            body: payload.callType === "video" ? "Video call" : "Voice call",
          },
          sound: "default",
        },
        type: "incoming_call",
        callId: payload.callId,
        fromUserId: payload.fromUserId,
        callType: payload.callType,
        callerName: payload.callerName ?? "",
      }),
    );
  });
}

/** Wake callee app + deliver metadata for incoming WebRTC call (FCM data-only). */
export async function sendCallInviteDataPush(
  toUserId: string,
  data: CallInvitePayload,
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

/** Sends APNs VoIP pushes to stored PushKit tokens for iOS background ringing. */
export async function sendVoipCallInvitePush(toUserId: string, data: CallInvitePayload): Promise<void> {
  try {
    const user = await User.findById(toUserId).select("voipTokens").lean();
    const tokens = [...new Set((user?.voipTokens ?? []).filter(Boolean))];
    if (!tokens.length) return;
    const stale: string[] = [];
    await Promise.all(
      tokens.map(async token => {
        const status = await sendApnsVoip(token, data);
        if (status === 400 || status === 410) stale.push(token);
      }),
    );
    if (stale.length) {
      await User.updateOne({ _id: toUserId }, { $pull: { voipTokens: { $in: stale } } }).catch(() => null);
    }
  } catch (err) {
    console.warn("[push] voip call invite skipped:", err instanceof Error ? err.message : err);
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
