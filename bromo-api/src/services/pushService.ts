import admin from "firebase-admin";
import { User } from "../models/User.js";

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
