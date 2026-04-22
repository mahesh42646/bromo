import {authedFetch} from './authApi';

export type NotificationType =
  | 'like'
  | 'comment'
  | 'follow'
  | 'follow_request'
  | 'follow_accept'
  | 'mention'
  | 'message'
  | 'milestone';

export type AppNotification = {
  _id: string;
  actorId: {
    _id: string;
    username: string;
    displayName: string;
    profilePicture: string;
  };
  type: NotificationType;
  postId?: string;
  message: string;
  read: boolean;
  createdAt: string;
};

export type NotificationsResponse = {
  notifications: AppNotification[];
  unreadCount: number;
  page: number;
  hasMore: boolean;
};

export async function getNotifications(page = 1, unreadOnly = false): Promise<NotificationsResponse> {
  const res = await authedFetch(`/notifications?page=${page}&unreadOnly=${unreadOnly}`);
  if (!res.ok) throw new Error('Failed to fetch notifications');
  return res.json() as Promise<NotificationsResponse>;
}

let unreadCountSession: number | null = null;
let unreadCountInflight: Promise<number> | null = null;

export function clearUnreadCountSessionCache(): void {
  unreadCountSession = null;
  unreadCountInflight = null;
}

/** One network read per app session unless `force` (logout clears cache). */
export async function getUnreadCount(opts?: {force?: boolean}): Promise<number> {
  if (!opts?.force && unreadCountSession !== null) return unreadCountSession;
  if (!opts?.force && unreadCountInflight) return unreadCountInflight;

  const run = (async (): Promise<number> => {
    try {
      const res = await authedFetch('/notifications/unread-count');
      if (!res.ok) return 0;
      const data = await res.json() as {count: number};
      const c = data.count;
      unreadCountSession = c;
      return c;
    } catch {
      return 0;
    }
  })();

  if (!opts?.force) unreadCountInflight = run;
  try {
    return await run;
  } finally {
    if (unreadCountInflight === run) unreadCountInflight = null;
  }
}

export async function markAllRead(): Promise<void> {
  await authedFetch('/notifications/read-all', {method: 'POST'}).catch(() => null);
}

export async function markRead(id: string): Promise<void> {
  await authedFetch(`/notifications/${id}/read`, {method: 'PATCH'}).catch(() => null);
}
