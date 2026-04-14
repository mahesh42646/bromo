import mongoose, { Schema, type Document, type Types } from "mongoose";

export type NotificationType =
  | "like"
  | "comment"
  | "follow"
  | "follow_request"
  | "follow_accept"
  | "mention"
  | "message"
  | "milestone"
  | "media_ready";

export interface NotificationDoc extends Document {
  recipientId: Types.ObjectId;
  actorId: Types.ObjectId;
  type: NotificationType;
  postId?: Types.ObjectId;
  message: string;
  read: boolean;
  createdAt: Date;
}

const notificationSchema = new Schema<NotificationDoc>(
  {
    recipientId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: ["like", "comment", "follow", "follow_request", "follow_accept", "mention", "message", "milestone", "media_ready"],
      required: true,
    },
    postId: { type: Schema.Types.ObjectId, ref: "Post" },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
  },
  { timestamps: true },
);

notificationSchema.index({ recipientId: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, read: 1 });

export const Notification = mongoose.model<NotificationDoc>("Notification", notificationSchema);

/** Helper — create a notification only if actor ≠ recipient (unless it's a milestone). */
export async function createNotification(data: {
  recipientId: string | Types.ObjectId;
  actorId: string | Types.ObjectId;
  type: NotificationType;
  postId?: string | Types.ObjectId;
  message: string;
}): Promise<void> {
  /** Self-notifications are allowed for milestones and upload pipeline (`media_ready`). */
  if (
    data.type !== "milestone" &&
    data.type !== "media_ready" &&
    String(data.recipientId) === String(data.actorId)
  ) {
    return;
  }
  try {
    await Notification.create(data);
    const rid = String(data.recipientId);
    void import("../services/socketService.js").then(({ emitNotificationUnreadForUser }) =>
      emitNotificationUnreadForUser(rid),
    );
  } catch {
    // never block the caller
  }
}

/** Check follower milestone (100, 1 000, 10 000 …) and create a milestone notification. */
export async function checkFollowerMilestone(
  userId: string | Types.ObjectId,
  followersCount: number,
): Promise<void> {
  const milestones = [10, 50, 100, 500, 1_000, 5_000, 10_000, 50_000, 100_000, 1_000_000];
  if (milestones.includes(followersCount)) {
    await createNotification({
      recipientId: userId,
      actorId: userId,
      type: "milestone",
      message: `🎉 You reached ${followersCount.toLocaleString()} followers!`,
    });
  }
}

/** Check like milestone (100, 1 000 …) and create a milestone notification for the post author. */
export async function checkLikeMilestone(
  authorId: string | Types.ObjectId,
  likesCount: number,
  postId: string | Types.ObjectId,
): Promise<void> {
  const milestones = [10, 50, 100, 500, 1_000, 5_000, 10_000, 100_000];
  if (milestones.includes(likesCount)) {
    await createNotification({
      recipientId: authorId,
      actorId: authorId,
      type: "milestone",
      postId,
      message: `🔥 Your post reached ${likesCount.toLocaleString()} likes!`,
    });
  }
}
